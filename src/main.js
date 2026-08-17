const fs = require("fs");
const path = require("path");

const turf = require("@turf/turf");

const {
    prepareDetections
} = require("./time-filter");

const {
    projectPoint,
    unprojectPoint
} = require("./projection");

const {
    calculateKDE
} = require("./kde");


// =====================================================
// SETTINGS
// =====================================================

const BANDWIDTH = 500;

const GRID_SIZE = 150;

const MIN_MINUTES = 30;


// =====================================================
// PATHS
// =====================================================

const inputPath =
    path.join(
        __dirname,
        "..",
        "data",
        "detections",
        "tiger_detections.json"
    );


const outputDirectory =
    path.join(
        __dirname,
        "..",
        "output"
    );


const outputPath =
    path.join(
        outputDirectory,
        "tiger_ranges.geojson"
    );


// Create output directory

if (!fs.existsSync(outputDirectory)) {

    fs.mkdirSync(
        outputDirectory,
        {
            recursive: true
        }
    );

}


// =====================================================
// LOAD DATA
// =====================================================

const rawData =
    JSON.parse(
        fs.readFileSync(
            inputPath,
            "utf8"
        )
    );


console.log(
    "\n=============================="
);

console.log(
    " TIGER KDE RANGE CALCULATION"
);

console.log(
    "==============================\n"
);


// =====================================================
// FIND TIGERS
// =====================================================

const tigerIds = [

    ...new Set(
        rawData.map(
            d => d.tiger_id
        )
    )

];


console.log(
    "Tigers found:",
    tigerIds.join(", ")
);


// =====================================================
// FINAL GEOJSON
// =====================================================

const allFeatures = [];


// =====================================================
// PROCESS EACH TIGER
// =====================================================

for (
    const tigerId of tigerIds
) {

    console.log(
        `\nProcessing ${tigerId}...`
    );


    // ---------------------------------------------
    // Get this tiger's detections
    // ---------------------------------------------

    const tigerDetections =
        rawData.filter(
            d =>
                d.tiger_id ===
                tigerId
        );


    console.log(
        "Raw detections:",
        tigerDetections.length
    );


    // ---------------------------------------------
    // Time filtering
    // ---------------------------------------------

    const independentDetections =
        prepareDetections(
            tigerDetections,
            MIN_MINUTES
        );


    console.log(
        "Independent detections:",
        independentDetections.length
    );


    // ---------------------------------------------
    // We need enough points
    // ---------------------------------------------

    if (
        independentDetections.length < 5
    ) {

        console.log(
            "Not enough detections. Skipping."
        );

        continue;

    }


    // ---------------------------------------------
    // Project coordinates
    // ---------------------------------------------

    const projectedPoints =
        independentDetections.map(
            detection => {

                const point =
                    projectPoint(
                        detection.latitude,
                        detection.longitude
                    );


                return {

                    ...detection,

                    x: point.x,

                    y: point.y

                };

            }
        );


    // ---------------------------------------------
    // KDE
    // ---------------------------------------------

    const kde =
        calculateKDE(
            projectedPoints,
            BANDWIDTH,
            GRID_SIZE
        );


    console.log(
        "KDE cells:",
        kde.grid.length
    );


    // ---------------------------------------------
    // Maximum density
    // ---------------------------------------------

    const maxDensity =
        Math.max(
            ...kde.grid.map(
                cell =>
                    cell.density
            )
        );


    console.log(
        "Maximum density:",
        maxDensity
    );


    // =================================================
    // UTILIZATION DISTRIBUTION
    // =================================================

    /*
       Every grid cell has:

           density × cell area

       This gives the probability mass
       represented by the cell.

       We sort cells from highest density
       to lowest density.

       Then we accumulate probability
       until we reach:

           50%
           95%
    */


    const cellArea =
        kde.cellWidth *
        kde.cellHeight;


    const cells =
        kde.grid.map(
            cell => ({

                ...cell,

                probabilityMass:
                    cell.density *
                    cellArea

            })
        );


    const totalMass =
        cells.reduce(
            (sum, cell) =>
                sum +
                cell.probabilityMass,
            0
        );


    cells.forEach(
        cell => {

            cell.probability =
                cell.probabilityMass /
                totalMass;

        }
    );


    // Highest density first

    cells.sort(
        (a, b) =>
            b.density -
            a.density
    );


    let cumulative = 0;


    for (
        const cell of cells
    ) {

        cumulative +=
            cell.probability;

        cell.cumulative =
            cumulative;

    }


    // =================================================
    // EXTRACT 50% AND 95%
    // =================================================

    const selected50 =
        cells.filter(
            cell =>
                cell.cumulative <=
                0.50
        );


    const selected95 =
        cells.filter(
            cell =>
                cell.cumulative <=
                0.95
        );


    console.log(
        "50% cells:",
        selected50.length
    );


    console.log(
        "95% cells:",
        selected95.length
    );


    // =================================================
    // CREATE POLYGON FROM SELECTED CELLS
    // =================================================

    function createUtilizationPolygon(
        selectedCells,
        percentage
    ) {

        if (
            selectedCells.length < 3
        ) {

            return null;

        }


        // ---------------------------------------------
        // Convert selected grid cells to points
        // ---------------------------------------------

        const features =
            selectedCells.map(
                cell => {

                    const point =
                        unprojectPoint(
                            cell.x,
                            cell.y
                        );


                    return turf.point(
                        [
                            point.longitude,
                            point.latitude
                        ]
                    );

                }
            );


        const collection =
            turf.featureCollection(
                features
            );


        // ---------------------------------------------
        // Concave hull
        // ---------------------------------------------

        let polygon =
            turf.concave(
                collection,
                {
                    maxEdge:
                        BANDWIDTH * 3,
                    units: "meters"
                }
            );


        // ---------------------------------------------
        // Fallback to convex hull
        // ---------------------------------------------

        if (!polygon) {

            polygon =
                turf.convex(
                    collection
                );

        }


        if (!polygon) {

            return null;

        }


        // ---------------------------------------------
        // Area
        // ---------------------------------------------

        const areaM2 =
            turf.area(
                polygon
            );


        const areaKm2 =
            areaM2 / 1000000;


        console.log(
            `${percentage}% area:`,
            areaKm2.toFixed(2),
            "km²"
        );


        polygon.properties = {

            tiger_id:
                tigerId,

            type:
                percentage === 50
                    ? "core"
                    : "range",

            utilization:
                percentage,

            area_km2:
                Number(
                    areaKm2.toFixed(2)
                ),

            bandwidth_m:
                BANDWIDTH,

            independent_detections:
                independentDetections.length

        };


        return polygon;

    }


    // =================================================
    // 50% CORE
    // =================================================

    const corePolygon =
        createUtilizationPolygon(
            selected50,
            50
        );


    if (corePolygon) {

        allFeatures.push(
            corePolygon
        );

    }


    // =================================================
    // 95% RANGE
    // =================================================

    const rangePolygon =
        createUtilizationPolygon(
            selected95,
            95
        );


    if (rangePolygon) {

        allFeatures.push(
            rangePolygon
        );

    }


    // =================================================
    // ADD DETECTION POINTS
    // =================================================

    for (
        const detection of
        independentDetections
    ) {

        const point =
            turf.point(
                [
                    detection.longitude,
                    detection.latitude
                ],
                {

                    tiger_id:
                        tigerId,

                    type:
                        "detection",

                    camera_id:
                        detection.camera_id,

                    timestamp:
                        detection.timestamp,

                    hour:
                        detection.hour,

                    month:
                        detection.month,

                    is_night:
                        detection.isNight

                }
            );


        allFeatures.push(
            point
        );

    }

}


// =====================================================
// CREATE FINAL GEOJSON
// =====================================================

const geojson = {

    type:
        "FeatureCollection",

    features:
        allFeatures

};


// =====================================================
// SAVE
// =====================================================

fs.writeFileSync(

    outputPath,

    JSON.stringify(
        geojson,
        null,
        2
    )

);


console.log(
    "\n=============================="
);

console.log(
    "DONE"
);

console.log(
    "=============================="
);

console.log(
    "\nOutput:"
);

console.log(
    outputPath
);

console.log(
    "\nOpen index.html to view the ranges."
);