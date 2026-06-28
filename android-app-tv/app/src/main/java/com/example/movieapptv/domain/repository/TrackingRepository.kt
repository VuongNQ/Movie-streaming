package com.example.movieapptv.domain.repository

interface TrackingRepository {
    suspend fun getLastWatchedMovieId(): String?
    suspend fun getPositionSeconds(movieId: String): Int
    suspend fun updateTracking(movieId: String, positionSeconds: Int)
    suspend fun markMovieWatched(movieId: String)
    suspend fun clearMovieWatched(movieId: String)
    suspend fun isMovieWatched(movieId: String): Boolean
    suspend fun getWatchedMovieIds(): Set<String>
}
