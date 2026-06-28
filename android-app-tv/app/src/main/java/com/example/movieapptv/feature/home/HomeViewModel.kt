package com.example.movieapptv.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.movieapptv.domain.model.Movie
import com.example.movieapptv.domain.repository.MovieRepository
import com.example.movieapptv.domain.repository.TrackingRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class HomeMovieFilter {
    ALL,
    WATCHED,
    UNWATCHED,
}

data class HomeUiState(
    val isLoading: Boolean = true,
    val movies: List<Movie> = emptyList(),
    val filteredMovies: List<Movie> = emptyList(),
    val selectedFilter: HomeMovieFilter = HomeMovieFilter.ALL,
    val watchedMovieIds: Set<String> = emptySet(),
    val continueWatchingMovieId: String? = null,
    val errorMessage: String? = null,
)

class HomeViewModel(
    private val movieRepository: MovieRepository,
    private val trackingRepository: TrackingRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        reload()
    }

    fun reload() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching {
                val movies = movieRepository.getMovies()
                val continueWatchingMovieId = trackingRepository.getLastWatchedMovieId()
                val watchedMovieIds = trackingRepository.getWatchedMovieIds()
                val selectedFilter = _uiState.value.selectedFilter
                _uiState.value = HomeUiState(
                    isLoading = false,
                    movies = movies,
                    filteredMovies = applyFilter(movies, watchedMovieIds, selectedFilter),
                    selectedFilter = selectedFilter,
                    watchedMovieIds = watchedMovieIds,
                    continueWatchingMovieId = continueWatchingMovieId,
                )
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Failed to load movies",
                    )
                }
            }
        }
    }

    fun setFilter(filter: HomeMovieFilter) {
        _uiState.update { state ->
            state.copy(
                selectedFilter = filter,
                filteredMovies = applyFilter(state.movies, state.watchedMovieIds, filter),
            )
        }
    }

    private fun applyFilter(
        movies: List<Movie>,
        watchedMovieIds: Set<String>,
        filter: HomeMovieFilter,
    ): List<Movie> {
        return when (filter) {
            HomeMovieFilter.ALL -> movies
            HomeMovieFilter.WATCHED -> movies.filter { it.id in watchedMovieIds }
            HomeMovieFilter.UNWATCHED -> movies.filter { it.id !in watchedMovieIds }
        }
    }

    companion object {
        fun factory(
            movieRepository: MovieRepository,
            trackingRepository: TrackingRepository,
        ): ViewModelProvider.Factory {
            return object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return HomeViewModel(movieRepository, trackingRepository) as T
                }
            }
        }
    }
}
