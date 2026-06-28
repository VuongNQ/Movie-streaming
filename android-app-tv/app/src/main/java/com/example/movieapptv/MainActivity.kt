package com.example.movieapptv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.example.movieapptv.app.TvAppRoot
import com.example.movieapptv.core.designsystem.MovieTvTheme

/**
 * Compose entry-point for Android TV app.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MovieTvTheme {
                TvAppRoot()
            }
        }
    }
}