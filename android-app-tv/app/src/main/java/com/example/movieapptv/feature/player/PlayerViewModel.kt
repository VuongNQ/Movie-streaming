package com.example.movieapptv.feature.player

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

data class PlayerUiState(
    val isLoading: Boolean = true,
    val movie: Movie? = null,
    val startPositionSeconds: Int = 0,
    val errorMessage: String? = null,
)

class PlayerViewModel(
    private val movieId: String,
    private val movieRepository: MovieRepository,
    private val trackingRepository: TrackingRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    init {
        loadMovie()
    }

    private fun loadMovie() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching {
                val movie = movieRepository.getMovieById(movieId)
                val position = trackingRepository.getPositionSeconds(movieId)
                movie to position
            }.onSuccess { (movie, position) ->
                _uiState.value = PlayerUiState(
                    isLoading = false,
                    movie = movie,
                    startPositionSeconds = position,
                    errorMessage = if (movie == null) "Movie not found" else null,
                )
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        errorMessage = error.message ?: "Failed to load movie",
                    )
                }
            }
        }
    }

    fun persistPosition(positionSeconds: Int) {
        viewModelScope.launch {
            trackingRepository.updateTracking(movieId = movieId, positionSeconds = positionSeconds)
        }
    }

    fun markMovieWatched() {
        viewModelScope.launch {
            trackingRepository.markMovieWatched(movieId)
        }
    }

    companion object {
        fun factory(
            movieId: String,
            movieRepository: MovieRepository,
            trackingRepository: TrackingRepository,
        ): ViewModelProvider.Factory {
            return object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return PlayerViewModel(movieId, movieRepository, trackingRepository) as T
                }
            }
        }
    }
}
