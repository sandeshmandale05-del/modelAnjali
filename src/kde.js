function gaussianKernel(distance, bandwidth) {

    const coefficient =
        1 /
        (
            2 *
            Math.PI *
            bandwidth *
            bandwidth
        );

    const exponent =
        -(
            distance * distance
        ) /
        (
            2 *
            bandwidth *
            bandwidth
        );

    return coefficient *
           Math.exp(exponent);
}


function calculateKDE(
    points,
    bandwidth = 500,
    gridSize = 150
) {

    let minX = Infinity;
    let maxX = -Infinity;

    let minY = Infinity;
    let maxY = -Infinity;


    for (const point of points) {

        minX =
            Math.min(
                minX,
                point.x
            );

        maxX =
            Math.max(
                maxX,
                point.x
            );

        minY =
            Math.min(
                minY,
                point.y
            );

        maxY =
            Math.max(
                maxY,
                point.y
            );
    }


    // Padding around observations

    const padding =
        bandwidth * 3;


    minX -= padding;
    maxX += padding;

    minY -= padding;
    maxY += padding;


    const cellWidth =
        (maxX - minX) /
        gridSize;


    const cellHeight =
        (maxY - minY) /
        gridSize;


    const grid = [];


    for (
        let row = 0;
        row < gridSize;
        row++
    ) {

        for (
            let col = 0;
            col < gridSize;
            col++
        ) {

            const x =
                minX +
                (col + 0.5) *
                cellWidth;


            const y =
                minY +
                (row + 0.5) *
                cellHeight;


            let density = 0;


            for (
                const point of points
            ) {

                const dx =
                    x - point.x;

                const dy =
                    y - point.y;


                const distance =
                    Math.sqrt(
                        dx * dx +
                        dy * dy
                    );


                density +=
                    gaussianKernel(
                        distance,
                        bandwidth
                    );
            }


            density /=
                points.length;


            grid.push({

                row,

                col,

                x,

                y,

                density

            });

        }
    }


    return {

        grid,

        minX,

        maxX,

        minY,

        maxY,

        cellWidth,

        cellHeight,

        gridSize

    };
}


module.exports = {
    calculateKDE
};