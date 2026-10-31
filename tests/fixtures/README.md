# Recognition fixture

`thumb_up.jpg` and `pointing_up.jpg` are official Google MediaPipe test assets,
downloaded from https://storage.googleapis.com/mediapipe-assets/thumb_up.jpg and
https://storage.googleapis.com/mediapipe-assets/pointing_up.jpg .

Browser tests use this image as a fake webcam frame. They do not access the user's camera.
The hand-tracking tests use the real bundled MediaPipe model. Model adapter tests clearly
stub provider responses; they do not claim to measure real-world recognition accuracy.
