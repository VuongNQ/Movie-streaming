package com.example.movieapptv

import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

class MainActivity : FragmentActivity() {
    private val auth by lazy { FirebaseAuth.getInstance() }
    private val db by lazy { FirebaseFirestore.getInstance("moviestreaming") }
    private lateinit var message: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showAccessScreen()
    }

    override fun onStart() {
        super.onStart()
        checkAccess()
    }

    private fun showAccessScreen() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }
        message = TextView(this).apply { text = "Sign in to watch movies"; textSize = 22f }
        val email = EditText(this).apply { hint = "Email"; inputType = 33 }
        val password = EditText(this).apply { hint = "Password"; inputType = 129 }
        val signIn = Button(this).apply { text = "Sign in" }
        val signOut = Button(this).apply { text = "Sign out" }
        layout.addView(message)
        layout.addView(email)
        layout.addView(password)
        layout.addView(signIn)
        layout.addView(signOut)
        setContentView(layout)
        signIn.setOnClickListener {
            message.text = "Signing in…"
            auth.signInWithEmailAndPassword(email.text.toString().trim(), password.text.toString())
                .addOnSuccessListener { checkAccess() }
                .addOnFailureListener { message.text = it.localizedMessage ?: "Sign-in failed" }
        }
        signOut.setOnClickListener {
            signOut()
        }
    }

    fun signOut() {
        auth.signOut()
        MovieList.remoteMovies = emptyList()
        showAccessScreen()
    }

    private fun checkAccess() {
        val uid = auth.currentUser?.uid ?: return
        message.text = "Checking access…"
        db.collection("users").document(uid).get()
            .addOnSuccessListener { profile ->
                val allowed = profile.getString("role") == "admin" || profile.getBoolean("approved") == true
                if (!allowed || profile.getString("account_status") == "disabled") {
                    message.text = "This account is waiting for approval"
                    return@addOnSuccessListener
                }
                db.collection("movies").limit(100).get()
                    .addOnSuccessListener { movies ->
                        val list = movies.documents.mapIndexed { index, movie ->
                            Movie(
                                id = index.toLong(),
                                title = movie.getString("title_raw"),
                                description = movie.getString("description"),
                                backgroundImageUrl = movie.getString("background_link"),
                                cardImageUrl = movie.getString("thumbnail_link"),
                                videoUrl = (movie.get("stream_connections") as? List<*>)
                                    ?.filterIsInstance<Map<*, *>>()
                                    ?.firstOrNull { it["status"] == "live" }
                                    ?.get("link") as? String
                            )
                        }
                        MovieList.remoteMovies = list
                        setContentView(R.layout.activity_main)
                        supportFragmentManager.beginTransaction()
                            .replace(R.id.main_browse_fragment, MainFragment()).commit()
                    }
                    .addOnFailureListener { message.text = it.localizedMessage ?: "Unable to load movies" }
            }
            .addOnFailureListener { message.text = it.localizedMessage ?: "Unable to check access" }
    }
}
