package com.example.movieapptv.feature.details

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.movieapptv.domain.model.Movie
import com.example.movieapptv.domain.repository.MovieRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class DetailsUiState(
    val isLoading: Boolean = true,
    val movie: Movie? = null,
    val suggestedMovies: List<Movie> = emptyList(),
    val errorMessage: String? = null,
)

class DetailsViewModel(
    private val movieId: String,
    private val movieRepository: MovieRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DetailsUiState())
    val uiState: StateFlow<DetailsUiState> = _uiState.asStateFlow()

    init {
        loadMovie()
    }

    private fun loadMovie() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }
            runCatching { movieRepository.getMovieById(movieId) }
                .onSuccess { movie ->
                    if (movie == null) {
                        _uiState.value = DetailsUiState(
                            isLoading = false,
                            errorMessage = "Movie not found",
                        )
                        return@onSuccess
                    }

                    val suggestedMovies = movieRepository.getMovies()
                        .filterNot { it.id == movie.id }
                        .filter { candidate ->
                            val movieLinksCandidate = movie.franchiseMovieIds.contains(candidate.id)
                            val candidateLinksMovie = candidate.franchiseMovieIds.contains(movie.id)
                            movie.type == "franchise" && movieLinksCandidate || candidateLinksMovie
                        }

                    _uiState.value = DetailsUiState(
                        isLoading = false,
                        movie = movie,
                        suggestedMovies = suggestedMovies,
                        errorMessage = null,
                    )
                }
                .onFailure { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = error.message ?: "Failed to load movie details",
                        )
                    }
                }
        }
    }

    companion object {
        fun factory(movieId: String, movieRepository: MovieRepository): ViewModelProvider.Factory {
            return object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return DetailsViewModel(movieId, movieRepository) as T
                }
            }
        }
    }
}
