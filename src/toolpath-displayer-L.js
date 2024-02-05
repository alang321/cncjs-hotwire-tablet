// Display the XY-plane projection of a GCode toolpath on a 2D canvas

"use strict;"

$(function () {
    var root = window;

    var canvas = document.getElementById("small-toolpath-L");
    var tp = canvas.getContext("2d");
    var rect;

    var upscaler = 4;

    tp.lineWidth = 0.5;
    tp.lineCap = 'round';
    tp.strokeStyle = 'blue';

    var units = 'G21';

    var bbox = {
        min: {
            x: Infinity,
            y: Infinity
        },
        max: {
            x: -Infinity,
            y: -Infinity
        }
    };
    var bboxIsSet = false;

    var resetBbox = function () {
        bbox.min.x = Infinity;
        bbox.min.y = Infinity;
        bbox.max.x = -Infinity;
        bbox.max.y = -Infinity;
        bboxIsSet = false;

    }

    var formatLimit = function (mm) {
        return (units == 'G20') ? (mm / 25.4).toFixed(3) + '"' : mm.toFixed(2) + 'mm';
    }

    var toolX = null;
    var toolY = null;
    var toolSave = null;
    var toolRadius = 4;
    var toolRectWH = toolRadius * 2 + 20;  // Slop to encompass the entire image area

    var drawTool = function (pos) {
        toolX = xToPixel(pos.z) - toolRadius - 10;
        toolY = yToPixel(pos.a) - toolRadius - 10;

        toolSave = tp.getImageData(toolX, toolY, Math.round(toolRectWH * scaler), Math.round(toolRectWH * scaler));

        tp.beginPath();
        tp.strokeStyle = 'magenta';
        tp.fillStyle = 'magenta';
        tp.arc(pos.z, pos.a, toolRadius / scaler, 0, Math.PI * 2, true);
        tp.fill();
        tp.stroke();
    }

    var drawOrigin = function () {
        tp.clearRect(0, 0, canvas.width, canvas.height);

        var grid_size = 40;
        var x_axis_distance_grid_lines = 0;
        var y_axis_distance_grid_lines = 0;
        var x_axis_starting_point = { number: 1, suffix: '' };
        var y_axis_starting_point = { number: 1, suffix: '' };
        // canvas width
        var canvas_width = canvas.width;

        // canvas height
        var canvas_height = canvas.height;
        // no of vertical grid lines
        var num_lines_x = Math.floor(canvas_height / grid_size);

        // no of horizontal grid lines
        var num_lines_y = Math.floor(canvas_width / grid_size);

        var lw_grid = 4.9 / 4 / scaler * upscaler;
        var lw_tick = 2 * scaler;
        var len_tick = 4 * scaler;
        var text_grid = '35px Arial';

        // Draw grid lines along X-axis
        for (var i = 0; i <= num_lines_x; i++) {
            tp.beginPath();
            tp.lineWidth = lw_grid;

            // If line represents X-axis draw in different color
            if (i == x_axis_distance_grid_lines)
                tp.strokeStyle = "#000000";
            else
                tp.strokeStyle = "#e9e9e9";

            if (i == num_lines_x) {
                tp.moveTo(0, yToPixel(grid_size * i));
                tp.lineTo(canvas_width, yToPixel(grid_size * i));
            }
            else {
                tp.moveTo(0, yToPixel(grid_size * i) + 0.5);
                tp.lineTo(canvas_width, yToPixel(grid_size * i) + 0.5);
            }
            tp.stroke();
        }

        // Draw grid lines along Y-axis
        for (i = 0; i <= num_lines_y; i++) {
            tp.beginPath();
            tp.lineWidth = lw_grid;

            // If line represents Y-axis draw in different color
            if (i == y_axis_distance_grid_lines)
                tp.strokeStyle = "#000000";
            else
                tp.strokeStyle = "#e9e9e9";

            if (i == num_lines_y) {
                tp.moveTo(xToPixel(grid_size * i), 0);
                tp.lineTo(xToPixel(grid_size * i), canvas_height);
            }
            else {
                tp.moveTo(xToPixel(grid_size * i) + 0.5, 0);
                tp.lineTo(xToPixel(grid_size * i) + 0.5, canvas_height);
            }
            tp.stroke();
        }

        // Ticks marks along the positive X-axis
        for (i = 1; i < (num_lines_y - y_axis_distance_grid_lines); i++) {
            tp.beginPath();
            tp.lineWidth = lw_tick;
            tp.strokeStyle = "#000000";

            // Draw a tick mark 6px long (-3 to 3)
            tp.moveTo(xToPixel(grid_size * i) + 0.5, yToPixel(0) - len_tick);
            tp.lineTo(xToPixel(grid_size * i) + 0.5, yToPixel(0) + len_tick);
            tp.stroke();

            // Text value at that point
            tp.font = text_grid;
            tp.textAlign = 'start';
            tp.fillText(grid_size * i / 10, xToPixel(grid_size * i) - 5.5 * scaler, yToPixel(0) + 10 * scaler);
        }

        // Ticks marks along the negative X-axis
        for (i = 1; i < y_axis_distance_grid_lines + 1; i++) {
            tp.beginPath();
            tp.lineWidth = lw_tick;
            tp.strokeStyle = "#000000";

            // Draw a tick mark 6px long (-3 to 3)
            tp.moveTo(xToPixel(-grid_size * i) + 0.5, yToPixel(0) - len_tick);
            tp.lineTo(xToPixel(-grid_size * i) + 0.5, yToPixel(0) + len_tick);
            tp.stroke();

            // Text value at that point
            tp.font = text_grid;
            tp.textAlign = 'end';
            tp.fillText(grid_size * i / 10, -xToPixel(grid_size * i) - 5.5 * scaler, yToPixel(0) + 10 * scaler);
        }

        // Ticks marks along the positive Y-axis
        // Positive Y-axis of graph is negative Y-axis of the canvas
        for (i = 1; i < (num_lines_x - x_axis_distance_grid_lines) + 1; i++) {
            tp.beginPath();
            tp.lineWidth = lw_tick;
            tp.strokeStyle = "#000000";

            // Draw a tick mark 6px long (-3 to 3)
            tp.moveTo(xToPixel(0) - len_tick, yToPixel(grid_size * i) + 0.5);
            tp.lineTo(xToPixel(0) + len_tick, yToPixel(grid_size * i) + 0.5);
            tp.stroke();

            // Text value at that point
            tp.font = text_grid;
            tp.textAlign = 'start';
            tp.fillText(grid_size * i / 10, xToPixel(0) - 25 * scaler, yToPixel(grid_size * i) - 6 * scaler);
        }

        // Ticks marks along the negative Y-axis
        // Negative Y-axis of graph is positive Y-axis of the canvas
        for (i = 1; i < x_axis_distance_grid_lines + 1; i++) {
            tp.beginPath();
            tp.lineWidth = lw_tick;
            tp.strokeStyle = "#000000";

            // Draw a tick mark 6px long (-3 to 3)
            tp.moveTo(xToPixel(0) - len_tick, yToPixel(-grid_size * i) + 0.5);
            tp.lineTo(xToPixel(0) + len_tick, yToPixel(-grid_size * i) + 0.5);
            tp.stroke();

            // Text value at that point
            tp.font = text_grid;
            tp.textAlign = 'start';
            tp.fillText(-grid_size * i / 10, xToPixel(0) - 25 * scaler, yToPixel(-grid_size * i) + 6 * scaler);
        }

        //tp.translate(y_axis_distance_grid_lines*grid_size, x_axis_distance_grid_lines*grid_size);
    }

    var xOffset = 0;
    var yOffset = 0;
    var scaler = 1;
    var xToPixel = function (x) { return scaler * x + xOffset; }
    var yToPixel = function (y) { return -scaler * y + yOffset; }

    var transformCanvas = function () {
        toolSave = null;
        if (rect == undefined) {
            rect = canvas.parentNode.getBoundingClientRect();
            canvas.width = rect.width * upscaler;
            canvas.height = rect.height * upscaler;
            //var devicePixelRatio = window.devicePixelRatio || 1;
            //canvas.width = Math.round (devicePixelRatio * rect.right) - Math.round (devicePixelRatio * rect.left);
            //canvas.height = Math.round (devicePixelRatio * rect.bottom) - Math.round (devicePixelRatio * rect.top);
        }

        // Reset the transform and clear the canvas
        tp.setTransform(1, 0, 0, 1, 0, 0);
        tp.fillStyle = "white";
        tp.fillRect(0, 0, canvas.width, canvas.height);

        var imageWidth;
        var imageHeight;
        var inset;
        if (!bboxIsSet) {
            imageWidth = canvas.width;
            imageHeight = canvas.height;
            inset = 0;
            scaler = 1;
            xOffset = 0;
            yOffset = 0;
            return;
        }

        var imageWidth = bbox.max.x - bbox.min.x;
        var imageHeight = bbox.max.y - bbox.min.y;
        if (imageWidth == 0) {
            imageWidth = 1;
        }
        if (imageHeight == 0) {
            imageHeight = 1;
        }
        var shrink = 0.90;
        inset = 20 * upscaler;
        var scaleX = (canvas.width - inset) / imageWidth;
        var scaleY = (canvas.height - inset) / imageHeight;
        var minScale = Math.min(scaleX, scaleY);

        scaler = minScale * shrink;
        if (scaler < 0) {
            scaler = -scaler;
        }

        xOffset = inset - bbox.min.x * scaler;
        yOffset = (canvas.height - inset) - bbox.min.y * (-scaler);

        // Canvas coordinates of image bounding box top and right
        var imageTop = scaler * imageHeight;
        var imageRight = scaler * imageWidth;

        // Show the X and Y limit coordinates of the GCode program.
        // We do this before scaling because after we invert the Y coordinate,
        // text would be displayed upside-down.
        tp.fillStyle = "black";
        tp.font = "14px Ariel";
        tp.textAlign = "center";
        tp.textBaseline = "bottom";
        tp.fillText(formatLimit(bbox.min.y), imageRight / 2, canvas.height - inset);
        tp.textBaseline = "top";
        tp.fillText(formatLimit(bbox.max.y), imageRight / 2, canvas.height - inset - imageTop);
        tp.textAlign = "left";
        tp.textBaseline = "center";
        tp.fillText(formatLimit(bbox.min.x), inset, canvas.height - inset - imageTop / 2);
        tp.textAlign = "right";
        tp.textBaseline = "center";
        tp.fillText(formatLimit(bbox.max.x), inset + imageRight, canvas.height - inset - imageTop / 2);
        // Transform the path coordinate system so the image fills the canvas
        // with a small inset, and +Y goes upward.
        // The net transform from image space (x,y) to pixel space (x',y') is:
        //   x' =  scaler*x + xOffset
        //   y' = -scaler*y + yOffset
        // We use setTransform() instead of a sequence of scale() and translate() calls
        // because we need to perform the transform manually for getImageData(), which
        // uses pixel coordinates, and there is no standard way to read back the current
        // transform matrix.

        drawOrigin();
        tp.lineWidth = 4.6 / 4 / scaler * upscaler;
        tp.setTransform(scaler, 0, 0, -scaler, xOffset, yOffset);

    }
    var wrappedDegrees = function (radians) {
        var degrees = radians * 180 / Math.PI;
        return degrees >= 0 ? degrees : degrees + 360;
    }

    var bboxHandlersL = {
        addLine: function (modal, start, end) {
            // Update units in case it changed in a previous line
            units = modal.units;

            bbox.min.x = Math.min(bbox.min.x, start.z, end.z, start.x, end.x);
            bbox.min.y = Math.min(bbox.min.y, start.a, end.a, start.y, end.y);
            bbox.max.x = Math.max(bbox.max.x, start.z, end.z, start.x, end.x);
            bbox.max.y = Math.max(bbox.max.y, start.a, end.a, start.y, end.y);
            bboxIsSet = true;
        },
        addArcCurve: function (modal, start, end, center) {
            // To determine the precise bounding box of a circular arc we
            // must account for the possibility that the arc crosses one or
            // more axes.  If so, the bounding box includes the "bulges" of
            // the arc across those axes.

            // Update units in case it changed in a previous line
            units = modal.units;

            if (modal.motion == 'G2') {  // clockwise
                var tmp = start;
                start = end;
                end = tmp;
            }

            // Coordinates relative to the center of the arc
            var sx = start.z - center.z;
            var sy = start.a - center.a;
            var ex = end.z - center.z;
            var ey = end.a - center.a;

            var radius = Math.hypot(sx, sy);

            // Axis crossings - plus and minus x and y
            var px = false;
            var py = false;
            var mx = false;
            var my = false;

            // There are ways to express this decision tree in fewer lines
            // of code by converting to alternate representations like angles,
            // but this way is probably the most computationally efficient.
            // It avoids any use of transcendental functions.  Every path
            // through this decision tree is either 4 or 5 simple comparisons.
            if (ey >= 0) {              // End in upper half plane
                if (ex > 0) {             // End in quadrant 0 - X+ Y+
                    if (sy >= 0) {          // Start in upper half plane
                        if (sx > 0) {         // Start in quadrant 0 - X+ Y+
                            if (sx <= ex) {     // wraparound
                                px = py = mx = my = true;
                            }
                        } else {              // Start in quadrant 1 - X- Y+
                            mx = my = px = true;
                        }
                    } else {                // Start in lower half plane
                        if (sx > 0) {         // Start in quadrant 3 - X+ Y-
                            px = true;
                        } else {              // Start in quadrant 2 - X- Y-
                            my = px = true;
                        }
                    }
                } else {                  // End in quadrant 1 - X- Y+
                    if (sy >= 0) {          // Start in upper half plane
                        if (sx > 0) {         // Start in quadrant 0 - X+ Y+
                            py = true;
                        } else {              // Start in quadrant 1 - X- Y+
                            if (sx <= ex) {     // wraparound
                                px = py = mx = my = true;
                            }
                        }
                    } else {                // Start in lower half plane
                        if (sx > 0) {         // Start in quadrant 3 - X+ Y-
                            px = py = true;
                        } else {              // Start in quadrant 2 - X- Y-
                            my = px = py = true;
                        }
                    }
                }
            } else {                    // ey < 0 - end in lower half plane
                if (ex > 0) {             // End in quadrant 3 - X+ Y+
                    if (sy >= 0) {          // Start in upper half plane
                        if (sx > 0) {         // Start in quadrant 0 - X+ Y+
                            py = mx = my = true;
                        } else {              // Start in quadrant 1 - X- Y+
                            mx = my = true;
                        }
                    } else {                // Start in lower half plane
                        if (sx > 0) {         // Start in quadrant 3 - X+ Y-
                            if (sx >= ex) {      // wraparound
                                px = py = mx = my = true;
                            }
                        } else {              // Start in quadrant 2 - X- Y-
                            my = true;
                        }
                    }
                } else {                  // End in quadrant 2 - X- Y+
                    if (sy >= 0) {          // Start in upper half plane
                        if (sx > 0) {         // Start in quadrant 0 - X+ Y+
                            py = mx = true;
                        } else {              // Start in quadrant 1 - X- Y+
                            mx = true;
                        }
                    } else {                // Start in lower half plane
                        if (sx > 0) {         // Start in quadrant 3 - X+ Y-
                            px = py = mx = true;
                        } else {              // Start in quadrant 2 - X- Y-
                            if (sx >= ex) {      // wraparound
                                px = py = mx = my = true;
                            }
                        }
                    }
                }
            }
            var maxX = px ? center.z + radius : Math.max(start.z, end.z);
            var maxY = py ? center.a + radius : Math.max(start.a, end.a);
            var minX = mx ? center.z - radius : Math.min(start.z, end.z);
            var minY = my ? center.a - radius : Math.min(start.a, end.a);

            bbox.min.x = Math.min(bbox.min.x, minX);
            bbox.min.y = Math.min(bbox.min.y, minY);
            bbox.max.x = Math.max(bbox.max.x, maxX);
            bbox.max.y = Math.max(bbox.max.y, maxY);
            bboxIsSet = true;
        }
    };

    var initialMovesL = true;
    var displayHandlersL = {
        addLine: function (modal, start, end) {
            var motion = modal.motion;
            if (motion == 'G0') {
                tp.strokeStyle = initialMovesL ? 'red' : 'green';
            } else {
                tp.strokeStyle = 'blue';
                // Don't cancel initialMoves on no-motion G1 (e.g. G1 F30)
                // or on Z-only moves
                if (start.z != end.z || start.a != end.a) {
                    initialMovesL = false;
                }
            }

            tp.beginPath();
            tp.moveTo(start.z, start.a);
            tp.lineTo(end.z, end.a);
            tp.stroke();
        },
        addArcCurve: function (modal, start, end, center) {
            var motion = modal.motion;

            var deltaX1 = start.z - center.z;
            var deltaY1 = start.a - center.a;
            var radius = Math.hypot(deltaX1, deltaY1);
            var deltaX2 = end.z - center.z;
            var deltaY2 = end.a - center.a;
            var theta1 = Math.atan2(deltaY1, deltaX1);
            var theta2 = Math.atan2(deltaY2, deltaX2);
            if (theta1 == theta2) {
                theta2 += Math.PI * ((modal.motion == "G2") ? -2 : 2);
            }

            initialMovesL = false;

            tp.beginPath();
            tp.strokeStyle = 'blue';
            tp.arc(center.z, center.a, radius, theta1, theta2, modal.motion == 'G2');
            tp.stroke();
        },
    };

    var ToolpathDisplayerL = function () {
    };

    var offset;

    ToolpathDisplayerL.prototype.showToolpathL = function (gcode, wpos, mpos) {
        inInches = $('[data-route="workspace"] [id="units"]').text() != 'mm';

        var factor = 1.0;

        var initialPosition = {
            x: wpos.x * factor,
            y: wpos.y * factor,
            z: wpos.z * factor,
            a: wpos.a * factor
        };

        var mposmm = {
            x: mpos.x * factor,
            y: mpos.y * factor,
            z: mpos.z * factor,
            a: mpos.a * factor
        };

        offset = {
            x: 0,
            y: 0,
            z: 0,
            a: 0
        };

        resetBbox();
        bboxHandlersL.position = initialPosition;

        var gcodeLines = gcode.split('\n');
        new Toolpath(bboxHandlersL).loadFromLinesSync(gcodeLines);
        transformCanvas();
        if (!bboxIsSet) {
            return;
        }
        initialMovesL = true;
        displayHandlersL.position = initialPosition;
        new Toolpath(displayHandlersL).loadFromLinesSync(gcodeLines);

        drawTool(initialPosition);
    };

    ToolpathDisplayerL.prototype.reDrawToolL = function (modal, wpos) {
        if (toolSave != null) {
            tp.putImageData(toolSave, toolX, toolY);
            var factor = 1.0;

            var dpos = {
                x: wpos.x * factor + offset.x,
                y: wpos.y * factor + offset.y,
                z: wpos.z * factor + offset.z,
                a: wpos.a * factor + offset.a
            };
            drawTool(dpos);
        }
    }


    root.displayerL = new ToolpathDisplayerL();
});