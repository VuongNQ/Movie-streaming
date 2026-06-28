package com.example.movieapptv.feature.details

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.example.movieapptv.R
import com.example.movieapptv.domain.repository.MovieRepository

@Composable
fun DetailsRoute(
    movieId: String,
    movieRepository: MovieRepository,
    onBack: () -> Unit,
    onWatchMovie: (String) -> Unit,
) {
    val viewModel: DetailsViewModel = viewModel(
        factory = DetailsViewModel.factory(movieId = movieId, movieRepository = movieRepository),
    )
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    if (uiState.isLoading) {
        DetailsMessage(stringResource(R.string.details_loading))
        return
    }
    if (uiState.errorMessage != null) {
        DetailsMessage(uiState.errorMessage)
        return
    }
    val movie = uiState.movie
    if (movie == null) {
        DetailsMessage(stringResource(R.string.details_movie_unavailable))
        return
    }

    BackHandler(onBack = onBack)

    val watchButtonFocusRequester = remember { FocusRequester() }

    LaunchedEffect(movie.id) {
        // Wait for first frame so focus request happens after layout is ready.
        withFrameNanos { }
        watchButtonFocusRequester.requestFocus()
    }

    val hasLiveStream = movie.preferredLiveStream() != null

    Box(modifier = Modifier.fillMaxSize()) {
        AsyncImage(
            model = movie.backgroundLink,
            contentDescription = movie.titleRaw,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(Color(0xE8000000), Color(0x8A000000), Color.Transparent),
                    ),
                ),
        )

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color(0xB0000000), Color(0xE6000000)),
                    ),
                ),
        )

        Column(
            modifier = Modifier
                .fillMaxWidth(0.62f)
                .align(Alignment.CenterStart)
                .padding(horizontal = 40.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = movie.titleRaw,
                style = MaterialTheme.typography.displaySmall,
                color = Color.White,
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(
                    modifier = Modifier
                        .height(10.dp)
                        .width(10.dp)
                        .clip(CircleShape)
                        .background(if (hasLiveStream) Color(0xFFFF4D36) else Color(0xFF7A7A7A)),
                )
                Text(
                    text = if (hasLiveStream) {
                        stringResource(R.string.details_live)
                    } else {
                        stringResource(R.string.details_unavailable)
                    },
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color(0xFFE8E8E8),
                )
                Text(
                    text = stringResource(R.string.details_episode_count, movie.episodeCount),
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color(0xFFD9D9D9),
                )
                Text(
                    text = movie.year.toString(),
                    style = MaterialTheme.typography.bodyLarge,
                    color = Color(0xFFD9D9D9),
                )
            }

            Text(
                text = movie.description,
                style = MaterialTheme.typography.bodyLarge,
                color = Color(0xFFF1F1F1),
                maxLines = 2,
            )

            Text(
                text = stringResource(R.string.details_more),
                style = MaterialTheme.typography.bodyMedium,
                color = Color.White,
                modifier = Modifier.alpha(0.9f),
            )

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = { onWatchMovie(movie.id) },
                modifier = Modifier.focusRequester(watchButtonFocusRequester),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White,
                    contentColor = Color(0xFF141414),
                ),
            ) {
                Text(stringResource(R.string.rent_hd_price))
            }
        }
    }
}

@Composable
private fun DetailsMessage(text: String?) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF08151C)),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text ?: stringResource(R.string.details_unknown_state), color = Color.White)
    }
}
