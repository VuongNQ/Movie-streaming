package com.example.movieapptv.data.repository

import android.content.Context
import com.example.movieapptv.domain.repository.TrackingRepository

class LocalTrackingRepository(context: Context) : TrackingRepository {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    override suspend fun getLastWatchedMovieId(): String? {
        return prefs.getString(KEY_LAST_WATCHED_MOVIE_ID, null)
    }

    override suspend fun getPositionSeconds(movieId: String): Int {
        return prefs.getInt(positionKey(movieId), 0).coerceAtLeast(0)
    }

    override suspend fun updateTracking(movieId: String, positionSeconds: Int) {
        prefs.edit()
            .putString(KEY_LAST_WATCHED_MOVIE_ID, movieId)
            .putInt(positionKey(movieId), positionSeconds.coerceAtLeast(0))
            .apply()
    }

    override suspend fun markMovieWatched(movieId: String) {
        val watched = getWatchedMovieIds().toMutableSet()
        watched.add(movieId)
        prefs.edit().putStringSet(KEY_WATCHED_MOVIE_IDS, watched).apply()
    }

    override suspend fun clearMovieWatched(movieId: String) {
        val watched = getWatchedMovieIds().toMutableSet()
        watched.remove(movieId)
        prefs.edit().putStringSet(KEY_WATCHED_MOVIE_IDS, watched).apply()
    }

    override suspend fun isMovieWatched(movieId: String): Boolean {
        return getWatchedMovieIds().contains(movieId)
    }

    override suspend fun getWatchedMovieIds(): Set<String> {
        return prefs.getStringSet(KEY_WATCHED_MOVIE_IDS, emptySet())?.toSet() ?: emptySet()
    }

    private fun positionKey(movieId: String): String = "position_$movieId"

    private companion object {
        const val PREFS_NAME = "movie_tracking"
        const val KEY_LAST_WATCHED_MOVIE_ID = "last_watched_movie_id"
        const val KEY_WATCHED_MOVIE_IDS = "watched_movie_ids"
    }
}
