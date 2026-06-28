package com.example.movieapptv.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.movieapptv.domain.repository.MovieRepository
import com.example.movieapptv.domain.repository.TrackingRepository
import com.example.movieapptv.feature.details.DetailsRoute
import com.example.movieapptv.feature.home.HomeRoute
import com.example.movieapptv.feature.player.PlayerRoute

@Composable
fun TvNavGraph(
    movieRepository: MovieRepository,
    trackingRepository: TrackingRepository,
) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = TvRoutes.HOME,
    ) {
        composable(TvRoutes.HOME) {
            HomeRoute(
                movieRepository = movieRepository,
                trackingRepository = trackingRepository,
                onMovieSelected = { movieId -> navController.navigate(TvRoutes.details(movieId)) },
            )
        }

        composable(
            route = "${TvRoutes.DETAILS}/{${TvRoutes.ARG_MOVIE_ID}}",
            arguments = listOf(navArgument(TvRoutes.ARG_MOVIE_ID) { type = NavType.StringType }),
        ) { backStackEntry ->
            val movieId = backStackEntry.arguments?.getString(TvRoutes.ARG_MOVIE_ID) ?: return@composable
            DetailsRoute(
                movieId = movieId,
                movieRepository = movieRepository,
                onBack = { navController.popBackStack() },
                onWatchMovie = { selectedMovieId -> navController.navigate(TvRoutes.player(selectedMovieId)) },
            )
        }

        composable(
            route = "${TvRoutes.PLAYER}/{${TvRoutes.ARG_MOVIE_ID}}",
            arguments = listOf(navArgument(TvRoutes.ARG_MOVIE_ID) { type = NavType.StringType }),
        ) { backStackEntry ->
            val movieId = backStackEntry.arguments?.getString(TvRoutes.ARG_MOVIE_ID) ?: return@composable
            PlayerRoute(
                movieId = movieId,
                movieRepository = movieRepository,
                trackingRepository = trackingRepository,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
