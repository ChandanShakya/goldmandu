plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

// Optional overrides from CI: -PversionName=1.2.0 -PversionCode=12
val propVersionName = (project.findProperty("versionName") as String?)?.takeIf { it.isNotBlank() }
val propVersionCode = (project.findProperty("versionCode") as String?)?.toIntOrNull()

android {
  namespace = "np.goldmandu.app"
  compileSdk = 35

  defaultConfig {
    applicationId = "np.goldmandu.app"
    minSdk = 24
    targetSdk = 35
    versionCode = propVersionCode ?: 1
    versionName = propVersionName ?: "1.0.0"
    resourceConfigurations += listOf("en", "ne")
  }

  // Signing from env (GitHub Actions secrets). Falls back to unsigned release.
  val keystorePath = System.getenv("KEYSTORE_PATH")
  val keystoreFile = keystorePath?.let { file(it) }
  val hasReleaseKeystore =
    keystoreFile != null &&
      keystoreFile.exists() &&
      !System.getenv("KEYSTORE_PASSWORD").isNullOrEmpty() &&
      !System.getenv("KEY_ALIAS").isNullOrEmpty()

  if (hasReleaseKeystore) {
    signingConfigs {
      create("release") {
        storeFile = keystoreFile
        // release.p12 is PKCS12; .jks also works if you set KEYSTORE_TYPE=JKS
        storeType = System.getenv("KEYSTORE_TYPE") ?: "PKCS12"
        storePassword = System.getenv("KEYSTORE_PASSWORD")
        keyAlias = System.getenv("KEY_ALIAS")
        keyPassword = System.getenv("KEY_PASSWORD") ?: System.getenv("KEYSTORE_PASSWORD")
      }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      isDebuggable = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro",
      )
      if (hasReleaseKeystore) {
        signingConfig = signingConfigs.getByName("release")
      }
    }
    debug {
      isMinifyEnabled = false
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  packaging {
    resources {
      excludes += setOf(
        "META-INF/DEPENDENCIES",
        "META-INF/LICENSE*",
        "META-INF/NOTICE*",
        "META-INF/*.kotlin_module",
        "DebugProbesKt.bin",
        "kotlin/**",
      )
    }
  }
}

dependencies {
  // Intentionally no Material / Compose / OkHttp / Retrofit / WorkManager / Room.
  // Size target: release APK well under 2 MB.
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
