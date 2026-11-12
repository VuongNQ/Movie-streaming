package com.example.movieapptv.feature.player

import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.example.movieapptv.R
import com.example.movieapptv.domain.repository.MovieRepository
import com.example.movieapptv.domain.repository.TrackingRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
fun PlayerRoute(
    movieId: String,
    movieRepository: MovieRepository,
    trackingRepository: TrackingRepository,
    onBack: () -> Unit,
) {
    val viewModel: PlayerViewModel = viewModel(
        factory = PlayerViewModel.factory(
            movieId = movieId,
            movieRepository = movieRepository,
            trackingRepository = trackingRepository,
        ),
    )
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    if (uiState.isLoading) {
        PlayerMessage(stringResource(R.string.player_loading))
        return
    }
    if (uiState.errorMessage != null) {
        PlayerMessage(uiState.errorMessage)
        return
    }
    val movie = uiState.movie
    if (movie == null) {
        PlayerMessage(stringResource(R.string.details_movie_unavailable))
        return
    }
    val streams = movie.liveStreams()
    if (streams.isEmpty()) {
        PlayerMessage(stringResource(R.string.player_no_live_stream))
        return
    }

    PlayerScreen(
        streamUrls = streams.map { it.link },
        startPositionSeconds = uiState.startPositionSeconds,
        onProgress = viewModel::persistPosition,
        onMarkedWatched = viewModel::markMovieWatched,
        onBack = onBack,
    )
}

@Composable
private fun PlayerScreen(
    streamUrls: List<String>,
    startPositionSeconds: Int,
    onProgress: (Int) -> Unit,
    onMarkedWatched: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val player = remember(context, streamUrls) { ExoPlayer.Builder(context).build() }
    var sourceIndex by remember(player) { mutableIntStateOf(0) }
    var resumePositionMs by remember(player) { mutableLongStateOf(startPositionSeconds * 1000L) }
    var sourceHasPlayed by remember(player) { mutableStateOf(false) }
    var hasMarkedWatched by remember(player) { mutableStateOf(false) }
    var playbackFailed by remember(player) { mutableStateOf(false) }

    fun playSource(index: Int) {
        sourceIndex = index
        sourceHasPlayed = false
        playbackFailed = false
        val mediaItem = MediaItem.Builder()
            .setUri(streamUrls[index])
            .setMimeType(MimeTypes.APPLICATION_M3U8)
            .build()
        player.setMediaItem(mediaItem, resumePositionMs.takeIf { it > 0L } ?: C.TIME_UNSET)
        player.prepare()
        player.play()
    }

    fun saveProgress() {
        if (sourceHasPlayed) {
            resumePositionMs = player.currentPosition.coerceAtLeast(0L)
            onProgress((resumePositionMs / 1000L).toInt())
        }
    }

    fun maybeMarkWatched() {
        if (!sourceHasPlayed || hasMarkedWatched) {
            return
        }
        val duration = player.duration
        val position = player.currentPosition
        if (duration > 0L && position >= (duration * 0.9f).toLong()) {
            hasMarkedWatched = true
            onMarkedWatched()
        }
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) sourceHasPlayed = true
            }

            override fun onPlayerError(error: PlaybackException) {
                saveProgress()
                if (sourceIndex < streamUrls.lastIndex) {
                    playSource(sourceIndex + 1)
                } else {
                    sourceHasPlayed = false
                    playbackFailed = true
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    maybeMarkWatched()
                    saveProgress()
                }
            }
        }
        player.addListener(listener)
        playSource(0)

        onDispose {
            maybeMarkWatched()
            saveProgress()
            player.removeListener(listener)
            player.release()
        }
    }

    LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
        player.pause()
        saveProgress()
    }

    LaunchedEffect(player) {
        while (isActive) {
            delay(5000)
            if (player.isPlaying) {
                maybeMarkWatched()
                saveProgress()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        if (playbackFailed) {
            val retryFocus = remember { FocusRequester() }
            LaunchedEffect(retryFocus) {
                withFrameNanos { }
                retryFocus.requestFocus()
            }
            Column(
                modifier = Modifier.align(Alignment.Center).padding(40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                Text(
                    text = stringResource(R.string.player_playback_failed),
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color.White,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    PlayerAction(
                        label = stringResource(R.string.player_retry),
                        onClick = { playSource(0) },
                        modifier = Modifier.focusRequester(retryFocus),
                    )
                    PlayerAction(label = stringResource(R.string.player_back), onClick = onBack)
                }
            }
        } else {
            AndroidView(
                factory = { androidContext ->
                    PlayerView(androidContext).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        )
                        useController = true
                        this.player = player
                        requestFocus()
                    }
                },
                onReset = null,
                onRelease = { it.player = null },
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

@Composable
private fun PlayerAction(label: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    var focused by remember { mutableStateOf(false) }
    Button(
        onClick = onClick,
        modifier = modifier.onFocusChanged { focused = it.isFocused },
        colors = ButtonDefaults.buttonColors(
            containerColor = if (focused) Color.White else Color(0xFF313C47),
            contentColor = if (focused) Color.Black else Color.White,
        ),
    ) {
        Text(label)
    }
}

@Composable
private fun PlayerMessage(text: String?) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text ?: stringResource(R.string.player_unknown_state), color = Color.White)
    }
}
