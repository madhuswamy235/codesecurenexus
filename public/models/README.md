# Local multi-face count model

`blaze_face_short_range.tflite` is the MediaPipe BlazeFace short-range detector used only for optional, on-device face counts in the candidate's browser preview. It is not an identity-recognition model. The source model is distributed by MediaPipe:

https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite

The client-side runtime uses the pinned `@mediapipe/tasks-vision` package. No camera frame or detector result other than a count for a multiple-face event is uploaded by the detector.
