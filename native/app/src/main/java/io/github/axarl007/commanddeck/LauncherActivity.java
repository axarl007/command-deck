/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.github.axarl007.commanddeck;

import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.google.androidbrowserhelper.trusted.sharing.ShareTarget;

import java.util.Arrays;
import java.util.Collections;


public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    // Mirrors manifest.json's share_target. Hand-authored, not `bubblewrap
    // update`-generated: this project was created before manifest.json
    // declared share_target (see native/README.md), and this environment's
    // network policy blocks the Android SDK download `bubblewrap update`
    // needs to regenerate the project properly. getShareTarget() is the
    // androidbrowserhelper LauncherActivity hook this library documents for
    // opting an existing TWA into Web Share Target handling (routes an
    // incoming ACTION_SEND/ACTION_SEND_MULTIPLE intent into a real POST
    // navigation to the share_target action against the verified origin) —
    // it has NOT been compiled or run here (no Android SDK in this sandbox).
    //
    // UNVERIFIED, HIGHEST-RISK SPOT IN THIS FILE: the exact ShareTarget
    // constructor signature below (arg count/order — specifically, whether it
    // needs the share_target action URL as an explicit argument, or derives
    // its POST destination from getLaunchingUrl() instead) is written from
    // memory, not from androidbrowserhelper:2.6.2's actual source, and is the
    // first thing to check — with the library's real source or a compiler in
    // hand — before trusting that a share actually reaches the app.
    private static final ShareTarget SHARE_TARGET = new ShareTarget(
            "POST",
            "multipart/form-data",
            new ShareTarget.Params(
                    "title",
                    "text",
                    "url",
                    Collections.singletonList(new ShareTarget.FileFormField(
                            "files",
                            Arrays.asList("image/*", "application/pdf")))
            )
    );

    @Override
    protected ShareTarget getShareTarget() {
        return SHARE_TARGET;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Setting an orientation crashes the app due to the transparent background on Android 8.0
        // Oreo and below. We only set the orientation on Oreo and above. This only affects the
        // splash screen and Chrome will still respect the orientation.
        // See https://github.com/GoogleChromeLabs/bubblewrap/issues/496 for details.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }

    @Override
    protected Uri getLaunchingUrl() {
        // Get the original launch Url.
        Uri uri = super.getLaunchingUrl();

        

        return uri;
    }
}
