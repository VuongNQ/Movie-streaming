package com.example.movieapptv.app

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.example.movieapptv.BuildConfig
import com.example.movieapptv.data.repository.FirestoreMovieRepository
import com.example.movieapptv.data.repository.LocalTrackingRepository
import com.example.movieapptv.navigation.TvNavGraph
import com.google.firebase.firestore.FirebaseFirestore

@Composable
fun TvAppRoot() {
    val context = LocalContext.current
    val movieRepository = remember {
        FirestoreMovieRepository(FirebaseFirestore.getInstance(BuildConfig.FIRESTORE_DATABASE_ID))
    }
    val trackingRepository = remember { LocalTrackingRepository(context.applicationContext) }

    TvNavGraph(
        movieRepository = movieRepository,
        trackingRepository = trackingRepository,
    )
}
