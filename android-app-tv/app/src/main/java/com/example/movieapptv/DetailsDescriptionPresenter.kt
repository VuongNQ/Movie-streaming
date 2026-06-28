package com.example.movieapptv

import android.text.TextUtils
import androidx.core.content.ContextCompat
import androidx.leanback.widget.AbstractDetailsDescriptionPresenter

class DetailsDescriptionPresenter : AbstractDetailsDescriptionPresenter() {

    override fun onBindDescription(
        viewHolder: AbstractDetailsDescriptionPresenter.ViewHolder,
        item: Any
    ) {
        val movie = item as Movie

        viewHolder.title.text = movie.title
        viewHolder.subtitle.text = viewHolder.view.context.getString(R.string.details_meta_line)
        viewHolder.body.text = movie.description

        val white = ContextCompat.getColor(viewHolder.view.context, android.R.color.white)
        val muted = ContextCompat.getColor(viewHolder.view.context, android.R.color.darker_gray)

        viewHolder.title.apply {
            setTextColor(white)
            textSize = 48f
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }

        viewHolder.subtitle.apply {
            setTextColor(white)
            alpha = 0.88f
            textSize = 18f
        }

        viewHolder.body.apply {
            setTextColor(muted)
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
            isFocusable = false
            isFocusableInTouchMode = false
        }
    }
}