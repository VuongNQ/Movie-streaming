package com.example.movieapptv.domain.repository

import com.example.movieapptv.domain.model.Movie

interface MovieRepository {
    suspend fun getMovies(): List<Movie>
    suspend fun getMovieById(movieId: String): Movie?
}
