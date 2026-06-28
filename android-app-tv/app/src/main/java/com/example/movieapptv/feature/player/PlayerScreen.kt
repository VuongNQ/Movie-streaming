package com.example.movieapptv.feature.player

import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.MediaItem
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
    val stream = movie.preferredLiveStream()
    if (stream == null) {
        PlayerMessage(stringResource(R.string.player_no_live_stream))
        return
    }

    PlayerScreen(
        streamUrl = stream.link,
        startPositionSeconds = uiState.startPositionSeconds,
        onProgress = viewModel::persistPosition,
        onMarkedWatched = viewModel::markMovieWatched,
        onBack = onBack,
    )
}

@Composable
private fun PlayerScreen(
    streamUrl: String,
    startPositionSeconds: Int,
    onProgress: (Int) -> Unit,
    onMarkedWatched: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val player = remember(streamUrl) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(streamUrl))
            prepare()
            seekTo((startPositionSeconds * 1000L).coerceAtLeast(0L))
            playWhenReady = true
        }
    }

    var hasMarkedWatched by remember(streamUrl) { mutableStateOf(false) }

    fun maybeMarkWatched() {
        if (hasMarkedWatched) {
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
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                onBack()
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED) {
                    maybeMarkWatched()
                }
            }
        }
        player.addListener(listener)

        onDispose {
            maybeMarkWatched()
            onProgress((player.currentPosition / 1000L).toInt())
            player.removeListener(listener)
            player.release()
        }
    }

    LaunchedEffect(player) {
        while (isActive) {
            delay(5000)
            maybeMarkWatched()
            onProgress((player.currentPosition / 1000L).toInt())
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { androidContext ->
                PlayerView(androidContext).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    useController = true
                    this.player = player
                }
            },
            modifier = Modifier.fillMaxSize(),
        )
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
