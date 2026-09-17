# Keep line numbers for readable crash reports (tiny).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Platform JSON / networking are in the boot classpath.
-dontwarn org.json.**
-dontwarn java.net.**
-dontwarn javax.net.**
