// ==========================
// タブ切り替え
// ==========================

const cameraTab =
    document.getElementById("cameraTab");

const photoTab =
    document.getElementById("photoTab");

const cameraPage =
    document.getElementById("cameraPage");

const photoPage =
    document.getElementById("photoPage");


// 撮影タブ
cameraTab.addEventListener("click", () => {

    cameraTab.classList.add("active");
    photoTab.classList.remove("active");

    cameraPage.classList.add("active");
    photoPage.classList.remove("active");

});


// 写真タブ
photoTab.addEventListener("click", () => {

    photoTab.classList.add("active");
    cameraTab.classList.remove("active");

    photoPage.classList.add("active");
    cameraPage.classList.remove("active");

});

const cameraButton = document.getElementById("cameraButton");
const switchCameraButton = document.getElementById("switchCameraButton");
const takePhotoButton = document.getElementById("takePhotoButton");

const camera = document.getElementById("camera");
const canvas = document.getElementById("photoCanvas");
const photoList = document.getElementById("photoList");

let cameraStream = null;

// 現在使用しているカメラ
// "user" = 内カメラ
// "environment" = 外カメラ
let cameraFacingMode = "environment";

// ==========================
// 設定
// ==========================

// ==========================
// 保存期間の設定
// ==========================

// 初期設定：7日
const DEFAULT_SAVE_DAYS = 7;

// 保存期間を取得
let SAVE_DAYS = Number(
    localStorage.getItem("saveDays")
) || DEFAULT_SAVE_DAYS;

// 保存期間をミリ秒に変換
let SAVE_TIME =
    SAVE_DAYS * 24 * 60 * 60 * 1000;

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
            video: {
                facingMode: cameraFacingMode
            }
        });

        camera.srcObject = cameraStream;

    } catch (error) {

        alert("カメラを起動できませんでした。");
        console.error(error);

    }

});

// ==========================
// カメラを切り替える
// ==========================

switchCameraButton.addEventListener("click", async () => {

    // カメラが起動していなければ何もしない
    if (!cameraStream) {

        alert("先にカメラを起動してください。");
        return;

    }

    // 現在のカメラを停止
    cameraStream.getTracks().forEach((track) => {
        track.stop();
    });

    // 内カメラと外カメラを切り替える
    if (cameraFacingMode === "user") {
        cameraFacingMode = "environment";
    } else {
        cameraFacingMode = "user";
    }

    try {

        // 新しいカメラを起動
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: cameraFacingMode
            }
        });

        camera.srcObject = cameraStream;

    } catch (error) {

        alert("カメラを切り替えられませんでした。");
        console.error(error);

    }

});

// ==========================
// 写真を撮影する
// ==========================

takePhotoButton.addEventListener("click", async () => {

    if (!cameraStream) {
        alert("先にカメラを起動してください。");
        return;
    }

    // カメラの映像サイズが取得できるまで少し待つ
    if (camera.videoWidth === 0 || camera.videoHeight === 0) {

        await new Promise((resolve) => {
            camera.addEventListener("loadedmetadata", resolve, {
                once: true
            });
        });

    }

    // カメラ映像のサイズを設定
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;

    if (canvas.width === 0 || canvas.height === 0) {
        alert("カメラ映像を取得できませんでした。");
        return;
    }

    // カメラ映像を写真としてキャンバスにコピー
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

        if (!blob) {
            alert("写真を作成できませんでした。");
            return;
        }

        // 撮影日時
        const timestamp = Date.now();

        // データベースに保存
        savePhoto(blob, timestamp);

    }, "image/jpeg", 0.9);

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

            // 写真を入れる箱
            const container = document.createElement("div");

            // 写真
            const image = document.createElement("img");

            image.src = URL.createObjectURL(photo.image);

            // 削除ボタン
            const deleteButton = document.createElement("button");

            deleteButton.textContent = "🗑️ 削除";

            deleteButton.addEventListener("click", () => {

                deletePhoto(photo.id);

            });

            // 箱に写真とボタンを入れる
            container.appendChild(image);
            container.appendChild(deleteButton);

            // 画面に追加
            photoList.appendChild(container);

        });

    };

}


// ==========================
// 写真を1枚削除する
// ==========================

function deletePhoto(photoId) {

    const transaction = db.transaction(
        ["photos"],
        "readwrite"
    );

    const store = transaction.objectStore("photos");

    store.delete(photoId);

    transaction.oncomplete = () => {

        // 削除後に写真一覧を更新
        loadPhotos();

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

// ==========================
// 保存期間変更
// ==========================

const saveDaysInput =
    document.getElementById("saveDaysInput");

const saveDaysButton =
    document.getElementById("saveDaysButton");

const saveDaysText =
    document.getElementById("saveDaysText");


// 現在の保存期間を表示
saveDaysInput.value = SAVE_DAYS;

saveDaysText.textContent =
    `現在の保存期間：${SAVE_DAYS}日`;


// 保存期間変更ボタン
saveDaysButton.addEventListener("click", () => {

    const newDays =
        Number(saveDaysInput.value);

    // 入力チェック
    if (
        !Number.isInteger(newDays) ||
        newDays < 1
    ) {

        alert("1日以上の整数を入力してください。");
        return;

    }

    // 保存期間を更新
    SAVE_DAYS = newDays;

    SAVE_TIME =
        SAVE_DAYS * 24 * 60 * 60 * 1000;

    // iPhoneに設定を保存
    localStorage.setItem(
        "saveDays",
        SAVE_DAYS
    );

    // 表示を更新
    saveDaysText.textContent =
        `現在の保存期間：${SAVE_DAYS}日`;

    // 変更後、期限切れ写真を削除
    deleteExpiredPhotos();

    alert(
        `保存期間を${SAVE_DAYS}日に変更しました。`
    );

});
