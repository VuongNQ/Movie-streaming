package com.example.movieapptv.feature.home

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.ui.res.stringResource
import coil.compose.AsyncImage
import com.example.movieapptv.R
import com.example.movieapptv.domain.model.Movie
import com.example.movieapptv.domain.repository.MovieRepository
import com.example.movieapptv.domain.repository.TrackingRepository

@Composable
fun HomeRoute(
    movieRepository: MovieRepository,
    trackingRepository: TrackingRepository,
    onMovieSelected: (String) -> Unit,
) {
    val viewModel: HomeViewModel = viewModel(
        factory = HomeViewModel.factory(
            movieRepository = movieRepository,
            trackingRepository = trackingRepository,
        ),
    )
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    HomeScreen(
        uiState = uiState,
        onMovieSelected = onMovieSelected,
        onFilterChange = viewModel::setFilter,
        onRetry = viewModel::reload,
    )
}

@Composable
private fun HomeScreen(
    uiState: HomeUiState,
    onMovieSelected: (String) -> Unit,
    onFilterChange: (HomeMovieFilter) -> Unit,
    onRetry: () -> Unit,
) {
    when {
        uiState.isLoading -> FullscreenMessage(text = stringResource(R.string.home_loading_movies))
        uiState.errorMessage != null -> {
            FullscreenMessage(text = uiState.errorMessage) {
                Button(onClick = onRetry) {
                    Text(stringResource(R.string.home_retry))
                }
            }
        }

        uiState.movies.isEmpty() -> FullscreenMessage(text = stringResource(R.string.home_no_movies))
        else -> {
            val context = LocalContext.current
            val configuration = LocalConfiguration.current
            val currentLanguageTag = remember(configuration) {
                val appLanguageTags = AppCompatDelegate.getApplicationLocales().toLanguageTags()
                val activeTag = if (appLanguageTags.isNotBlank()) {
                    appLanguageTags
                } else {
                    context.resources.configuration.locales[0].toLanguageTag()
                }
                if (activeTag.startsWith("vi")) "vi" else "en"
            }

            val continueMovie = uiState.movies.firstOrNull { it.id == uiState.continueWatchingMovieId }
            var focusedItemId by remember(uiState.movies, continueMovie) {
                mutableStateOf(continueMovie?.id ?: uiState.movies.first().id)
            }

            LaunchedEffect(uiState.movies, uiState.filteredMovies, continueMovie) {
                val currentIsMissing =
                    (focusedItemId == continueMovie?.id).not() &&
                        uiState.filteredMovies.none { it.id == focusedItemId }
                if (focusedItemId.isBlank() || currentIsMissing) {
                    focusedItemId = continueMovie?.id
                        ?: uiState.filteredMovies.firstOrNull()?.id
                        ?: uiState.movies.first().id
                }
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF08151C)),
                contentPadding = PaddingValues(horizontal = 40.dp, vertical = 24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = stringResource(R.string.home_title),
                            style = MaterialTheme.typography.headlineLarge,
                            color = Color.White,
                        )
                        Button(
                            onClick = { toggleAppLanguage(currentLanguageTag) },
                        ) {
                            Text(
                                text = if (currentLanguageTag == "vi") {
                                    stringResource(R.string.switch_to_english)
                                } else {
                                    stringResource(R.string.switch_to_vietnamese)
                                },
                            )
                        }
                    }
                }

                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        FilterButton(
                            label = stringResource(R.string.home_filter_all),
                            isSelected = uiState.selectedFilter == HomeMovieFilter.ALL,
                            onClick = { onFilterChange(HomeMovieFilter.ALL) },
                        )

                        FilterButton(
                            label = stringResource(R.string.home_filter_watched),
                            isSelected = uiState.selectedFilter == HomeMovieFilter.WATCHED,
                            onClick = { onFilterChange(HomeMovieFilter.WATCHED) },
                        )

                        FilterButton(
                            label = stringResource(R.string.home_filter_unwatched),
                            isSelected = uiState.selectedFilter == HomeMovieFilter.UNWATCHED,
                            onClick = { onFilterChange(HomeMovieFilter.UNWATCHED) },
                        )

                        Text(
                            text = stringResource(
                                when (uiState.selectedFilter) {
                                    HomeMovieFilter.ALL -> R.string.home_filter_active_all
                                    HomeMovieFilter.WATCHED -> R.string.home_filter_active_watched
                                    HomeMovieFilter.UNWATCHED -> R.string.home_filter_active_unwatched
                                },
                            ),
                            color = Color(0xFFD2D8DC),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                }

                if (continueMovie != null) {
                    item {
                        ContinueWatchingCard(
                            movie = continueMovie,
                            isFocused = focusedItemId == continueMovie.id,
                            onFocused = { focusedItemId = continueMovie.id },
                            onClick = { onMovieSelected(continueMovie.id) },
                        )
                    }
                }

                item {
                    Text(
                        text = when (uiState.selectedFilter) {
                            HomeMovieFilter.ALL -> stringResource(R.string.home_all_movies)
                            HomeMovieFilter.WATCHED -> stringResource(R.string.home_watched_movies)
                            HomeMovieFilter.UNWATCHED -> stringResource(R.string.home_unwatched_movies)
                        },
                        style = MaterialTheme.typography.headlineMedium,
                        color = Color.White,
                    )
                }

                if (uiState.filteredMovies.isEmpty()) {
                    item {
                        Text(
                            text = stringResource(R.string.home_filter_empty),
                            color = Color(0xFFD2D8DC),
                            style = MaterialTheme.typography.bodyLarge,
                        )
                    }
                } else {
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                            items(uiState.filteredMovies, key = { it.id }) { movie ->
                                MoviePosterCard(
                                    movie = movie,
                                    isFocused = focusedItemId == movie.id,
                                    onFocused = { focusedItemId = movie.id },
                                    onClick = { onMovieSelected(movie.id) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private fun toggleAppLanguage(currentLanguageTag: String) {
    val nextLanguageTag = if (currentLanguageTag == "vi") "en" else "vi"
    AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(nextLanguageTag))
}

@Composable
private fun FilterButton(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isSelected) Color(0xFFFFD166) else Color(0xFF3F2F87),
            contentColor = if (isSelected) Color(0xFF101418) else Color.White,
        ),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge.copy(
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            ),
        )
    }
}

@Composable
private fun ContinueWatchingCard(
    movie: Movie,
    isFocused: Boolean,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.03f else 1f,
        animationSpec = spring(dampingRatio = 0.85f, stiffness = 450f),
        label = "continueCardScale",
    )

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(220.dp)
            .scale(scale)
            .clip(RoundedCornerShape(16.dp))
            .border(
                width = if (isFocused) 3.dp else 0.dp,
                color = if (isFocused) Color(0xFFFFD166) else Color.Transparent,
                shape = RoundedCornerShape(16.dp),
            )
            .onFocusChanged { if (it.isFocused) onFocused() }
            .clickable(onClick = onClick)
            .focusable(),
    ) {
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
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color(0xD9111111)),
                    ),
                ),
        )
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(20.dp),
        ) {
            Text(
                stringResource(R.string.home_continue_watching),
                color = Color.White,
                style = MaterialTheme.typography.titleMedium,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(movie.titleRaw, color = Color.White, style = MaterialTheme.typography.headlineSmall)
        }
    }
}

@Composable
private fun MoviePosterCard(
    movie: Movie,
    isFocused: Boolean,
    onFocused: () -> Unit,
    onClick: () -> Unit,
) {
    val scale by animateFloatAsState(
        targetValue = if (isFocused) 1.05f else 1f,
        animationSpec = spring(dampingRatio = 0.85f, stiffness = 500f),
        label = "posterCardScale",
    )

    Column(
        modifier = Modifier
            .width(220.dp)
            .scale(scale)
            .clip(RoundedCornerShape(10.dp))
            .border(
                width = if (isFocused) 3.dp else 0.dp,
                color = if (isFocused) Color(0xFFFFD166) else Color.Transparent,
                shape = RoundedCornerShape(10.dp),
            )
            .onFocusChanged { if (it.isFocused) onFocused() }
            .clickable(onClick = onClick)
            .focusable(),
    ) {
        AsyncImage(
            model = movie.thumbnailLink,
            contentDescription = movie.titleRaw,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .height(330.dp)
                .clip(RoundedCornerShape(10.dp)),
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = movie.titleRaw,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = Color.White,
        )
    }
}

@Composable
private fun FullscreenMessage(text: String, action: @Composable (() -> Unit)? = null) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF08151C))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = text, color = Color.White, style = MaterialTheme.typography.headlineSmall)
        if (action != null) {
            Spacer(modifier = Modifier.height(16.dp))
            action()
        }
    }
}
