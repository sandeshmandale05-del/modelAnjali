const proj4 = require("proj4");

const WGS84 = "EPSG:4326";

// UTM zone 44N
const UTM44N =
    "+proj=utm +zone=44 +datum=WGS84 +units=m +no_defs";


function projectPoint(latitude, longitude) {

    const [x, y] = proj4(
        WGS84,
        UTM44N,
        [
            longitude,
            latitude
        ]
    );

    return {
        x,
        y
    };
}


function unprojectPoint(x, y) {

    const [longitude, latitude] = proj4(
        UTM44N,
        WGS84,
        [x, y]
    );

    return {
        latitude,
        longitude
    };
}


module.exports = {
    projectPoint,
    unprojectPoint
};