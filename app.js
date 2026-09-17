const cameraButton = document.getElementById("cameraButton");
const takePhotoButton = document.getElementById("takePhotoButton");

const camera = document.getElementById("camera");
const canvas = document.getElementById("photoCanvas");
const photoList = document.getElementById("photoList");

let cameraStream = null;


// ==========================
// 設定
// ==========================

// 写真の保存期間：7日
const SAVE_DAYS = 7;

// 7日をミリ秒に変換
const SAVE_TIME = SAVE_DAYS * 24 * 60 * 60 * 1000;


// ==========================
// データベースを作る
// ==========================

let db;

const request = indexedDB.open("PhotoTimerDB", 1);

request.onupgradeneeded = (event) => {

    db = event.target.result;

    db.createObjectStore("photos", {
        keyPath: "id",
        autoIncrement: true
    });

};

request.onsuccess = (event) => {

    db = event.target.result;

    // 古い写真を削除
    deleteExpiredPhotos();

};


// ==========================
// カメラを起動する
// ==========================

cameraButton.addEventListener("click", async () => {

    try {

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true
        });

        camera.srcObject = cameraStream;

    } catch (error) {

        alert("カメラを起動できませんでした。");
        console.error(error);

    }

});


// ==========================
// 写真を撮影する
// ==========================

takePhotoButton.addEventListener("click", () => {

    if (!cameraStream) {

        alert("先にカメラを起動してください。");
        return;

    }

    // カメラ映像のサイズを取得
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    // カメラ映像をキャンバスにコピー
    const context = canvas.getContext("2d");

    context.drawImage(
        camera,
        0,
        0,
        canvas.width,
        canvas.height
    );

    // JPEG画像に変換
    canvas.toBlob((blob) => {

        // 撮影日時
        const timestamp = Date.now();

        // 写真を保存
        savePhoto(blob, timestamp);

    }, "image/jpeg");

});


// ==========================
// 写真を保存する
// ==========================

function savePhoto(blob, timestamp) {

    const transaction = db.transaction(
        ["photos"],
        "readwrite"
    );

    const store = transaction.objectStore("photos");

    store.add({
        image: blob,
        timestamp: timestamp
    });

    transaction.oncomplete = () => {

        // 保存後に写真を表示
        loadPhotos();

    };

}


// ==========================
// 保存された写真を読み込む
// ==========================

function loadPhotos() {

    if (!db) {
        return;
    }

    photoList.innerHTML = "";

    const transaction = db.transaction(
        ["photos"],
        "readonly"
    );

    const store = transaction.objectStore("photos");

    const request = store.getAll();

    request.onsuccess = () => {

        const photos = request.result;

        photos.forEach((photo) => {

            const image = document.createElement("img");

            image.src = URL.createObjectURL(photo.image);

            photoList.appendChild(image);

        });

    };

}


// ==========================
// 7日以上経った写真を削除
// ==========================

function deleteExpiredPhotos() {

    const now = Date.now();

    const transaction = db.transaction(
        ["photos"],
        "readwrite"
    );

    const store = transaction.objectStore("photos");

    const request = store.getAll();

    request.onsuccess = () => {

        const photos = request.result;

        photos.forEach((photo) => {

            // 写真を撮影してから何ミリ秒経ったか
            const elapsedTime = now - photo.timestamp;

            // 7日以上経過していたら削除
            if (elapsedTime >= SAVE_TIME) {

                store.delete(photo.id);

            }

        });

    };

    transaction.oncomplete = () => {

        // 削除後、残っている写真を表示
        loadPhotos();

    };

}