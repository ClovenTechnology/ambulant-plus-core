package com.fileutil;

import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ContentUris;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import androidx.core.app.ActivityCompat;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.apache.commons.io.FileUtils;

import java.util.ArrayList;
import java.util.List;

import java.io.InputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.BufferedOutputStream;
import java.io.OutputStream;

public class FileUtilModule extends ReactContextBaseJavaModule {


    private final ReactApplicationContext mReactContext;

    WritableMap response;

    public FileUtilModule(ReactApplicationContext reactContext) {
        super(reactContext);

        mReactContext = reactContext;
    }

    @Override
    public String getName() {
        return "FileUtilModule";
    }


    @ReactMethod
    public void getFilePath(String fileUri, final Callback callback){
        Uri uri = Uri.parse(fileUri);
        response = Arguments.createMap();
        Log.e("czq"," fileUri= "+fileUri+" uri="+uri);
        try {
            // WritableArray results = Arguments.createArray();
            if (uri != null) {
                WritableMap doc = getDataFromURI(uri);
                Log.e("czq"," doc= "+doc);
                callback.invoke(doc);
            }
        } catch (Exception e) {
            response.putString("error", e.toString());
            callback.invoke(response);
            return;
        }
    }


    private WritableMap getDataFromURI(Uri uri) {
        WritableMap map = Arguments.createMap();
        Activity currentActivity = getCurrentActivity();
        map.putString("uri", uri.toString());
        Log.e("czq","  uri.toString()="+uri.toString());
        String path = null;
        String readableSize = null;
        Long size = null;
        path = getPath(currentActivity, uri);
        Log.e("czq","  path="+path);
        if (path != null) {
            map.putString("path", path);
            readableSize = getFileReadableSize(path);
            size = getFileSize(path);
            Log.e("czq","  readableSize="+readableSize+" size= "+size);
            map.putString("readableSize", readableSize);
            map.putInt("size", size.intValue());
        } else {
            path = getFileFromUri(currentActivity, uri);
            if (!path.equals("error")) {
                readableSize = getFileReadableSize(path);
                size = getFileSize(path);
                map.putString("path", path);
                map.putString("readableSize", readableSize);
                map.putInt("size", size.intValue());
            }
        }
        Log.e("czq","  currentActivity.getContentResolver().getType(uri)="+currentActivity.getContentResolver().getType(uri)+" getFileNameFromUri(currentActivity, uri)= "+getFileNameFromUri(currentActivity, uri));
        map.putString("type", currentActivity.getContentResolver().getType(uri));
        map.putString("fileName", getFileNameFromUri(currentActivity, uri));
        return map;
    }


    @TargetApi(Build.VERSION_CODES.KITKAT)
    public static String getPath(final Context context, final Uri uri) {

        final boolean isKitKat = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT;
        // Log.e("czq","  getPath  isKitKat="+isKitKat+"  isDocumentUri="+DocumentsContract.isDocumentUri(context, uri));
        // DocumentProvider
        if (isKitKat && DocumentsContract.isDocumentUri(context, uri)) {
            Log.e("czq","  getPath  isKitKat="+isKitKat+"  isExternalStorageDocument(uri)="+isExternalStorageDocument(uri));
            // ExternalStorageProvider
            if (isExternalStorageDocument(uri)) {
                final String docId = DocumentsContract.getDocumentId(uri);
                Log.e("czq","  docId ="+docId);
                final String[] split = docId.split(":");
                final String type = split[0];

                if ("primary".equalsIgnoreCase(type)) {
                    return Environment.getExternalStorageDirectory() + "/" + split[1];
                }

                // TODO handle non-primary volumes
            }
            // DownloadsProvider
            else if (isDownloadsDocument(uri)) {

                final String id = DocumentsContract.getDocumentId(uri);
                final String[] split = id.split(":");
                final String type = split[0];
                if ("raw".equalsIgnoreCase(type)) {
                    return split[1];
                } else {
                    String prefix = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? "file:///" : "content://";
                    final Uri contentUri = ContentUris.withAppendedId(
                            Uri.parse(prefix + "downloads/public_downloads"), Long.valueOf(split[1]));

                    return getDataColumn(context, contentUri, null, null);
                }
            }
            // MediaProvider
            else if (isMediaDocument(uri)) {
                final String docId = DocumentsContract.getDocumentId(uri);
                final String[] split = docId.split(":");
                final String type = split[0];

                Uri contentUri = null;
                if ("image".equals(type)) {
                    contentUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                } else if ("video".equals(type)) {
                    contentUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                } else if ("audio".equals(type)) {
                    contentUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                }

                final String selection = "_id=?";
                final String[] selectionArgs = new String[]{
                        split[1]
                };

                return getDataColumn(context, contentUri, selection, selectionArgs);
            }
        }
        // MediaStore (and general)
        else if ("content".equalsIgnoreCase(uri.getScheme())) {

            // Return the remote address
            if (isGooglePhotosUri(uri))
                return uri.getLastPathSegment();

            return getDataColumn(context, uri, null, null);
        }
        // File
        else if ("file".equalsIgnoreCase(uri.getScheme())) {
            return uri.getPath();
        }

        return null;
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is ExternalStorageProvider.
     */
    public static boolean isExternalStorageDocument(Uri uri) {
        return "com.android.externalstorage.documents".equals(uri.getAuthority());
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is DownloadsProvider.
     */
    public static boolean isDownloadsDocument(Uri uri) {
        return "com.android.providers.downloads.documents".equals(uri.getAuthority());
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is MediaProvider.
     */
    public static boolean isMediaDocument(Uri uri) {
        return "com.android.providers.media.documents".equals(uri.getAuthority());
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is Google Photos.
     */
    public static boolean isGooglePhotosUri(Uri uri) {
        return "com.google.android.apps.photos.content".equals(uri.getAuthority());
    }

    public static String getDataColumn(Context context, Uri uri, String selection,
                                       String[] selectionArgs) {

        Cursor cursor = null;
        final String column = "_data";
        final String[] projection = {
                column
        };

        try {
            cursor = context.getContentResolver().query(uri, projection, selection, selectionArgs,
                    null);
            if (cursor != null && cursor.moveToFirst()) {
                final int column_index = cursor.getColumnIndexOrThrow(column);
                return cursor.getString(column_index);
            }
        } catch (Exception e) {
            Log.e("FileUtilModule", "Failed to get cursor, so return null for path", e);
        } finally {
            if (cursor != null)
                cursor.close();
        }
        return null;
    }

    private String getFileReadableSize(String path) {
        File file = new File(path);
        long size = FileUtils.sizeOf(file);
        return FileUtils.byteCountToDisplaySize(size);
    }

    private Long getFileSize (String path) {
        File file = new File(path);
        return file.length();
    }

    private String getFileFromUri(Activity activity, Uri uri) {
        //If it can't get path of file, file is saved in cache, and obtain path from there
        try {
            String filePath = activity.getCacheDir().toString();
            String fileName = getFileNameFromUri(activity, uri);
            String path = filePath + "/" + fileName;
            if (!fileName.equals("error") && saveFileOnCache(path, activity, uri)) {
                return path;
            } else {
                return "error";
            }
        } catch (Exception e) {
            //Log.d("FileUtilModule", "Error getFileFromStream");
            return "error";
        }
    }

    private String getFileNameFromUri(Activity activity, Uri uri) {
        Cursor cursor = activity.getContentResolver().query(uri, null, null, null, null);
        if (cursor != null && cursor.moveToFirst()) {
            final int column_index = cursor.getColumnIndexOrThrow("_display_name");
            return cursor.getString(column_index);
        } else {
            return "error";
        }
    }

    private boolean saveFileOnCache(String path, Activity activity, Uri uri) {
        //Log.d("FileUtilModule", "saveFileOnCache path: "+path);
        try {
            InputStream is = activity.getContentResolver().openInputStream(uri);
            OutputStream stream = new BufferedOutputStream(new FileOutputStream(path));
            int bufferSize = 1024;
            byte[] buffer = new byte[bufferSize];
            int len = 0;
            while ((len = is.read(buffer)) != -1) {
                stream.write(buffer, 0, len);
            }

            if (stream != null)
                stream.close();

            //Log.d("FileUtilModule", "saveFileOnCache done!");
            return true;

        } catch (Exception e) {
            //Log.d("FileUtilModule", "saveFileOnCache error");
            return false;
        }
    }

    // Required for RN 0.30+ modules than implement ActivityEventListener
    public void onNewIntent(Intent intent) {
    }

}
