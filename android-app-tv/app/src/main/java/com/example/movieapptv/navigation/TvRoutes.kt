package com.example.movieapptv.navigation

object TvRoutes {
    const val HOME = "home"
    const val DETAILS = "details"
    const val PLAYER = "player"
    const val ARG_MOVIE_ID = "movieId"

    fun details(movieId: String): String = "$DETAILS/$movieId"
    fun player(movieId: String): String = "$PLAYER/$movieId"
}
