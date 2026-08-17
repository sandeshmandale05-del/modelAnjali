function prepareDetections(detections, minMinutes = 30) {

    const sorted = [...detections].sort(
        (a, b) =>
            new Date(a.timestamp) -
            new Date(b.timestamp)
    );

    const accepted = [];

    const lastAcceptedByCamera = new Map();

    for (const detection of sorted) {

        const currentTime =
            new Date(detection.timestamp);

        const lastTime =
            lastAcceptedByCamera.get(
                detection.camera_id
            );

        if (lastTime) {

            const differenceMinutes =
                (currentTime - lastTime) /
                (1000 * 60);

            if (differenceMinutes < minMinutes) {
                continue;
            }
        }

        accepted.push({

            ...detection,

            date:
                currentTime
                    .toISOString()
                    .split("T")[0],

            hour:
                currentTime.getHours(),

            month:
                currentTime.getMonth() + 1,

            isNight:
                currentTime.getHours() >= 18 ||
                currentTime.getHours() < 6

        });

        lastAcceptedByCamera.set(
            detection.camera_id,
            currentTime
        );
    }

    return accepted;
}


module.exports = {
    prepareDetections
};