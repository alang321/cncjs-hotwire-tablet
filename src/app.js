

// Mofified
$(function () {

    const MACHINE_STALL = 0;
    const MACHINE_STOP = 1;
    const MACHINE_IDLE = 2;
    const MACHINE_RUN = 3;
    const MACHINE_HOLD = 4;
    const MACHINE_SLEEP = 5;
    const MACHINE_ALARM = 6;

    var first_update = true;
    var root = window;
    var cnc = root.cnc || {};
    var controller = cnc.controller;
    var oldFilename = '';
    var running = false;
    var userStopRequested = false;
    var oldState = null;
    var probing = false;
    var startTime = 0;
    var runTime = 0;
    var watchPath = '';
    var feedOverride = 1.0;
    var rapidOverride = 1.0;
    var spindleOverride = 1.0;
    var workflowState = '';
    var errorMessage;
    var receivedLines = 0;
    var lineStart = 0;
    var lineEnd = 0;
    var gCodeLoaded = false;
    var machineWorkflow = MACHINE_STALL;
    var wpos = {}, mpos = {};
    var velocity = 0;
    var spindleDirection;
    var stateName = "Init failed";
    var elapsedTime = 0;
    var modal = {};
    var senderHold = false;
    var senderHoldReason = '';
    var spindleSpeed = 0;

    var maxFeedrate = [-1, -1, -1, -1];
    var feedrate_reference = -1;
    var dynamic_reference = -1;
    var dynamic_scale_power = -1;

    cnc.initState = function () {
        // Select the "Load GCode File" heading instead of any file
        cnc.showGCode('', '');
        oldFilename = '';
        running = false;
        userStopRequested = false;
        oldState = null;
        probing = false;
    }

    controller.on('serialport:list', function (list) {
        var $el = $('[data-route="connection"] select[data-name="port"]');

        $el.empty();
        $.each(list, function (key, value) {
            var portText = value.port;
            if (value.manufacturer) {
                portText += ' (' + value.manufacturer + ')';
            }
            var $option = $('<option></option>')
                .attr('value', value.port)
                .attr('data-inuse', value.inuse)
                .html(portText);
            $el.append($option);
        });

        if (cnc.controllerType) {
            $('[data-route="connection"] select[data-name="controllerType"]').val(cnc.controllerType);
        }
        if (cnc.port) {
            $('[data-route="connection"] select[data-name="port"]').val(cnc.port);
        }
        if (cnc.baudrate) {
            $('[data-route="connection"] select[data-name="baudrate"]').val(cnc.baudrate);
        }

    });

    controller.on('serialport:open', function (options) {
        cnc.initState();

        var controllerType = options.controllerType;
        var port = options.port;
        var baudrate = options.baudrate;

        cnc.connected = true;
        cnc.controllerType = controllerType;
        cnc.port = port;
        cnc.baudrate = baudrate;

        $('[data-route="connection"] [data-name="btn-open"]').prop('disabled', true);
        $('[data-route="connection"] [data-name="btn-close"]').prop('disabled', false);

        Cookies.set('cnc.controllerType', controllerType, { expires: 365 });
        Cookies.set('cnc.port', port, { expires: 365 });
        Cookies.set('cnc.baudrate', baudrate, { expires: 365 });

        if (controllerType === 'Grbl') {
            // Read the settings so we can determine the units for position reports
            // This will trigger a Grbl:settings callback to set grblReportingUnits

            // This has a problem: The first status report arrives before the
            // settings report, so interpreting the numbers from the first status
            // report is ambiguous.  Subsequent status reports are interpreted correctly.
            // We work around that by deferring status reports until the settings report.
            // I commented this out because of https://github.com/cncjs/cncjs-shopfloor-tablet/issues/20
            controller.writeln('?');
            controller.writeln('$$');
            //controller.writeln('?');
        }

        root.location = '#/workspace';

        //cnc.controller.command('reset');
        //cnc.controller.command('unlock');
        //console.log('startup');
    });

    cnc.initAll = function (axis, coordinate) {
                cnc.initState();

        var controllerType = options.controllerType;
        var port = options.port;
        var baudrate = options.baudrate;

        cnc.connected = true;
        cnc.controllerType = controllerType;
        cnc.port = port;
        cnc.baudrate = baudrate;

        $('[data-route="connection"] [data-name="btn-open"]').prop('disabled', true);
        $('[data-route="connection"] [data-name="btn-close"]').prop('disabled', false);

        Cookies.set('cnc.controllerType', controllerType, { expires: 365 });
        Cookies.set('cnc.port', port, { expires: 365 });
        Cookies.set('cnc.baudrate', baudrate, { expires: 365 });

        if (controllerType === 'Grbl') {
            // Read the settings so we can determine the units for position reports
            // This will trigger a Grbl:settings callback to set grblReportingUnits

            // This has a problem: The first status report arrives before the
            // settings report, so interpreting the numbers from the first status
            // report is ambiguous.  Subsequent status reports are interpreted correctly.
            // We work around that by deferring status reports until the settings report.
            // I commented this out because of https://github.com/cncjs/cncjs-shopfloor-tablet/issues/20
            controller.writeln('?');
            controller.writeln('$$');
            //controller.writeln('?');
        }

        root.location = '#/workspace';

        //cnc.controller.command('reset');
        //cnc.controller.command('unlock');
        //console.log('startup');
    }

    controller.on('serialport:close', function (options) {
        var port = options.port;

        cnc.connected = false;
        cnc.controllerType = '';
        cnc.port = '';
        cnc.baudrate = 0;

        $('[data-route="connection"] [data-name="btn-open"]').prop('disabled', false);
        $('[data-route="connection"] [data-name="btn-close"]').prop('disabled', true);

        $('[data-route="workspace"] [data-name="active-state"]').text('-');

        root.location = '#/connection';
    });

    controller.on('serialport:error', function (options) {
        var port = options.port;

        console.log('Error opening serial port \'' + port + '\'');

        $('[data-route="connection"] [data-name="msg"]').html('<p style="color: red">Error opening serial port \'' + port + '\'</p>');

    });

    cnc.loadFile = function () {
        filename = document.getElementById('filename').value;

        controller.command('watchdir:load', filename);
    }

    cnc.goAxis = function (axis, coordinate) {
        cnc.click();
        controller.command('gcode', 'G90');
        controller.command('gcode', 'G0 ' + axis + coordinate);
    }

    cnc.goTwoAxes = function (axis1, axis2, coordinate) {
        cnc.click();
        controller.command('gcode', 'G90');
        controller.command('gcode', 'G0 ' + axis1 + coordinate + ' ' + axis2 + coordinate);
    }

    cnc.goAllAxes = function (coordinate) {
        cnc.click();
        controller.command('gcode', 'G90');
        controller.command('gcode', 'G0 X' + coordinate + ' Y' + coordinate + ' Z' + coordinate + ' A' + coordinate);
    }


    cnc.moveAxis = function (axis, field) {
        cnc.goAxis(axis, document.getElementById(field).value)
    }

    cnc.currentAxisPNum = function () {
        return 'P' + String(Number(modal.wcs.substring(1)) - 53);
    }

    cnc.updateSpindleFeedrate = function () {
        var rateText = Number(velocity).toFixed(0);
        var volt = Number(spindleSpeed/1000*24).toFixed(2);
        document.getElementById('active-state').innerHTML = rateText;
        document.getElementById('spindle-state').innerHTML = volt;

        document.getElementById('feed-override').innerHTML = String(Number(feedOverride).toFixed(0)) + '%';
        document.getElementById('hotwire-override').innerHTML = String(Number(spindleOverride).toFixed(0)) + '%';
    }

    cnc.setAxisByValue = function (axis, coordinate) {
        cnc.click();
        controller.command('gcode', 'G10 L20 ' + cnc.currentAxisPNum() + ' ' + axis + coordinate);
    }

    cnc.setAxis = function (axis, field) {
        cnc.setAxisByValue(axis, document.getElementById(field).value);
    }
    
    cnc.hotwireOn = function () {
        var input = document.getElementById('demo');
        var power = input.value;
        controller.command('lasertest:on', Number(power * (100 / 24)).toFixed(1), 0, 1000);
    }
    
    cnc.hotwireOnDyn = function () {
        var input = document.getElementById('demo');
        var power = input.value;
        controller.command('gcode', 'M4 S' + Number(power * (1000 / 24)).toFixed(1));
    }
    
    cnc.hotwireOff = function () {
        controller.command('lasertest:off');
    }
    

    cnc.MDIcmd = function (value) {
        cnc.click();
        controller.command('gcode', value);
    }

    cnc.MDI = function (field) {
        cnc.MDIcmd(document.getElementById(field).value);
    }

    cnc.adjustTemperature = function (increment) {
        switch (increment) {
            case -10:
                controller.command('spindleOverride', -10);
                break;
            case -1:
                controller.command('spindleOverride', -1);
                break;
            case 1:
                controller.command('spindleOverride', 1);
                break;
            case 10:
                controller.command('spindleOverride', 10);
                break;
            case 0:
                controller.command('spindleOverride', 0);
                break;
            default:
                break;
        }
    }

    cnc.adjustFeedrate = function (increment) {
        switch (increment) {
            case -10:
                controller.command('feedOverride', -10);
                break;
            case -1:
                controller.command('feedOverride', -1);
                break;
            case 1:
                controller.command('feedOverride', 1);
                break;
            case 10:
                controller.command('feedOverride', 10);
                break;
            case 0:
                controller.command('feedOverride', 0);
                break;
            default:
                break;
        }
    }

    cnc.zeroAxis = function (axis) {
        cnc.setAxisByValue(axis, 0);
    }

    cnc.zeroTwoAxes = function (axis1, axis2) {
        cnc.setAxisByValue(axis1, 0);
        cnc.setAxisByValue(axis2, 0);
    }

    cnc.zeroAllAxes = function () {
        cnc.setAxisByValue('X', 0);
        cnc.setAxisByValue('Y', 0);
        cnc.setAxisByValue('Z', 0);
        cnc.setAxisByValue('A', 0);
    }

    cnc.toggleFullscreen = function () {
        var messages = document.getElementById('messages');

        if (document.fullscreenElement) {
            document.exitFullscreen();
            messages.rows = 2;
        } else {
            document.documentElement.requestFullscreen();
            messages.rows = 4;
        }
        messages.scrollTop = messages.scrollHeight;
    }

    cnc.goHome = function () {
        cnc.click();
        controller.command('gcode', 'G28');
    }

    cnc.toggleUnits = function () {
        cnc.click();
        if (modal.units == 'G21') {
            controller.command('gcode', 'G20');
        } else {
            controller.command('gcode', 'G21');
        }
        // No need to fix the button label, as that will be done by the status watcher
    }

    cnc.setMaxFeedrate = function (axis, value) {
        if (value > 0) {
            maxFeedrate[axis] = value;
            var cmd = '$' + (110 + axis) + '=' + value;
            controller.command('gcode', cmd);
        }
    }

    cnc.maxFeedrateZ = function () {
        var idx = 2;
        var element = document.getElementById('max-vel-z');
        var value = element.value;
        if (value > 0) {
            cnc.setMaxFeedrate(idx, value);
        }else{
            if (maxFeedrate[idx] > 0) {
                element.value = maxFeedrate[idx];
            }
        }
    }

    cnc.maxFeedrateA = function () {
        var idx = 3;
        var element = document.getElementById('max-vel-a');
        var value = element.value;
        if (value > 0) {
            cnc.setMaxFeedrate(idx, value);
        }else{
            if (maxFeedrate[idx] > 0) {
                element.value = maxFeedrate[idx];
            }
        }
    }

    cnc.maxFeedrateX = function () {
        var idx = 0;
        var element = document.getElementById('max-vel-x');
        var value = element.value;
        if (value > 0) {
            cnc.setMaxFeedrate(idx, value);
        }else{
            if (maxFeedrate[idx] > 0) {
                element.value = maxFeedrate[idx];
            }
        }
    }

    cnc.maxFeedrateY = function () {
        var idx = 1;
        var element = document.getElementById('max-vel-y');
        var value = element.value;
        if (value > 0) {
            cnc.setMaxFeedrate(idx, value);
        }else{
            if (maxFeedrate[idx] > 0) {
                element.value = maxFeedrate[idx];
            }
        }
    }

    cnc.selectFeedrateReference = function () {
        var element = document.getElementById('feedrate-reference');
        var value = element.value;
        if (value > -1) {
            cnc.setFeedrateReference(value);
        }else{
            if (feedrate_reference > -1) {
                element.value = feedrate_reference;
            }
        }
    }

    cnc.setFeedrateReference = function (value) {
        if (value > -1) {
            feedrate_reference = value;
            var cmd = '$' + (87) + '=' + value;
            controller.command('gcode', cmd);
        }
    }

    cnc.selectDynamicReference = function () {
        var element = document.getElementById('dynamic-reference');
        var value = element.value;
        if (value > -1) {
            cnc.setDynamicReference(value);
        }else{
            if (dynamic_reference > -1) {
                element.value = dynamic_reference;
            }
        }
    }

    cnc.setDynamicReference = function (value) {
        if (value > -1) {
            dynamic_reference = value;
            var cmd = '$89=' + value;
            controller.command('gcode', cmd);
        }
    }

    cnc.selectDynamicScale = function () {
        var element = document.getElementById('dynamic-power-scale');
        var value = element.value;
        if (value > -1) {
            cnc.setDynamicScale(value);
        }else{
            if (dynamic_scale_power > -1) {
                element.value = dynamic_scale_power;
            }
        }
    }

    cnc.setDynamicScale = function (value) {
        if (value > -1) {
            dynamic_scale_power = value;
            var cmd = '$88=' + value;
            controller.command('gcode', cmd);
        }
    }

    cnc.btnSetDistance = function () {
        cnc.click();
        var distance = event.target.innerText;
        $('[data-route="workspace"] select[data-name="select-distance"]').val(distance);
    }

    cnc.setDistance = function (distance) {
        cnc.click();
        $('[data-route="workspace"] select[data-name="select-distance"]').val(distance);
    }

    cnc.click = function () { return }

    cnc.sendMove = function (cmd) {
        cnc.click();
        var jog = function (params) {
            params = params || {};
            var s = _.map(params, function (value, letter) {
                return '' + letter + value;
            }).join(' ');
            controller.command('gcode', 'G91'); // relative distance
            controller.command('gcode', 'G0 ' + s);
        };
        var move = function (params) {
            params = params || {};
            var s = _.map(params, function (value, letter) {
                return '' + letter + value;
            }).join(' ');
            controller.command('gcode', 'G91'); // relative distance
            controller.command('gcode', 'G0 ' + s);
        };
        var distance = Number($('[data-route="workspace"] select[data-name="select-distance"]').val()) || 0;

        var fn = {
            'G28': function () {
                controller.command('gcode', 'G28');
            },
            'G30': function () {
                controller.command('gcode', 'G30');
            },
            'X0Y0Z0': function () {
                move({ X: 0, Y: 0, Z: 0 })
            },
            'X0Y0Z0A0': function () {
                move({ X: 0, Y: 0, Z: 0, A: 0 })
            },
            'X0': function () {
                move({ X: 0 });
            },
            'Y0': function () {
                move({ Y: 0 });
            },
            'Z0': function () {
                move({ Z: 0 });
            },
            'X-Y+': function () {
                jog({ X: -distance, Y: distance });
            },
            'X+Y+': function () {
                jog({ X: distance, Y: distance });
            },
            'X-Y-': function () {
                jog({ X: -distance, Y: -distance });
            },
            'X+Y-': function () {
                jog({ X: distance, Y: -distance });
            },
            'Z-A+': function () {
                jog({ Z: -distance, A: distance });
            },
            'Z+A+': function () {
                jog({ Z: distance, A: distance });
            },
            'Z-A-': function () {
                jog({ Z: -distance, A: -distance });
            },
            'Z+A-': function () {
                jog({ Z: distance, A: -distance });
            },
            'X-': function () {
                jog({ X: -distance });
            },
            'X+': function () {
                jog({ X: distance });
            },
            'Y-': function () {
                jog({ Y: -distance });
            },
            'Y+': function () {
                jog({ Y: distance });
            },
            'Z-': function () {
                jog({ Z: -distance });
            },
            'Z+': function () {
                jog({ Z: distance });
            },
            'A-': function () {
                jog({ A: -distance });
            },
            'A+': function () {
                jog({ A: distance });
            },
            'X+Z+': function () {
                jog({ Z: distance, X: distance });
            },
            'X-Z-': function () {
                jog({ Z: -distance, X: -distance });
            },
            'Y+A+': function () {
                jog({ Y: distance, A: distance });
            },
            'Y-A-': function () {
                jog({ Y: -distance, A: -distance });
            },
            'X-Y+Z-A+': function () {
                jog({ X: -distance, Y: distance, Z: -distance, A: distance });
            },
            'X+Y+Z+A+': function () {
                jog({ X: distance, Y: distance, Z: distance, A: distance });
            },
            'X+Y-Z+A-': function () {
                jog({ X: distance, Y: -distance, Z: distance, A: -distance });
            },
            'X-Y-Z-A-': function () {
                jog({ X: -distance, Y: -distance, Z: -distance, A: -distance });
            }
        }[cmd];

        fn && fn();
    };

    echoData = function (data) {
        var messages = $('[data-route="workspace"] [id="messages"]');
        messages.text(messages.text() + "\n" + data);
        messages[0].scrollTop = messages[0].scrollHeight;
    }

    controller.on('serialport:read', function (data) {
        if (data.r) {
            cnc.line++;
        }
        if(data.startsWith('[MSG:Sleeping]')){
            machineWorkflow = MACHINE_SLEEP;
        }
        
        if (!data.startsWith('ok')) {
            echoData(data);
        }
        if (data.startsWith('error:')) {
            stateName = data;
        }
        //renderGrblState(data);
        cnc.updateView();
    });

    // GRBL reports position in units according to the $13 setting,
    // independent of the GCode in/mm parser state.
    // We track the $13 value by watching for the Grbl:settings event and by
    // watching for manual changes via serialport:write.  Upon initial connection,
    // we issue a settings request in serialport:open.
    var grblReportingUnits = 0;  // initially undefined

    controller.on('serialport:write', function (data) {
        //    var style = 'font-weight: bold; line-height: 20px; padding: 2px 4px; border: 1px solid; color: #00529B; background: #BDE5F8';
        //    console.log('%cW%c', style, '', data);

        // Track manual changes to the Grbl position reporting units setting
        // We are looking for either $13=0 or $13=1
        if (cnc.controllerType === 'Grbl') {
            cmd = data.split('=');
            if (cmd.length === 2 && cmd[0] === "$13") {
                grblReportingUnits = Number(cmd[1]) || 0;
            }
        }
    });

    controller.on('feeder:status', function (status) {
        // console.log('feeder', status);
    });

    controller.on('sender:status', function (status) {
        if (status.elapsedTime) {
            elapsedTime = status.elapsedTime;
        }
        if (cnc.controllerType != 'TinyG' && status.received) {
            // TinyG/g2core reports the line count in the state report,
            // reflecting the line that is actually being executed. That
            // is more interesting to the user than how many lines have
            // been sent, so we only use the sender line count if the
            // better one is not available.
            receivedLines = status.received;
        }

        senderHold = status.hold;
        if (senderHold) {
            if (status.holdReason) {
                if (status.holdReason.err) {
                    senderHoldReason = 'Error';
                    errorMessage = status.holdReason.err;
                } else {
                    senderHoldReason = status.holdReason.data;
                }
            } else {
                senderHoldReason = "";
            }
        }
        if (cnc.controllerType == 'Marlin') {
            cnc.updateView();
        }
    });

    // This is used for GRBL and Smoothie.  It sets machineWorkflow
    // and possibly adjusts stateName based on the state and the
    // reason for stopping.
    function setMachineWorkflow(stateName) {
        if (stateName == 'Idle') {
            machineWorkflow = MACHINE_IDLE;
            if (senderHold && senderHoldReason !== '%wait') {
                // M6 goes to IDLE state but the program has
                // has not really ended so we go to HOLD state.
                machineWorkflow = MACHINE_HOLD;
                stateName = senderHoldReason;
            }
        } else if (stateName == 'Hold') {
            machineWorkflow = MACHINE_HOLD;
            // M0 goes to HOLD state
            if (senderHold && senderHoldReason !== '%wait') {
                stateName = senderHoldReason;
            }
        } else if (stateName == 'Sleep') {
            machineWorkflow = MACHINE_SLEEP;
        } else if (stateName == 'Alarm') {
            machineWorkflow = MACHINE_ALARM;
        } else if (stateName.includes('error')) {
            //dont change the state
        } else {
            machineWorkflow = MACHINE_RUN;
        }
        return stateName;
    }


    // This is a copy of the Grbl:state report that came in before the Grbl:settings report
    var savedGrblState;

    function renderGrblState(data) {
        var status = data.status || {};
        stateName = status.activeState;
        mpos = status.mpos;
        wpos = status.wpos;

        //console.log(wpos, "wpos");

        // Grbl states are Idle, Run, Jog, Hold
        // The code used to allow click in Run state but that seems wrong
        // canClick = stateName == 'Idle';

        stateName = setMachineWorkflow(stateName);

        var parserstate = data.parserstate || {};
        if (parserstate.modal) {
            Object.assign(modal, parserstate.modal);
        }

        // Unit conversion factor - depends on both $13 setting and parser units
        var factor = 1.0;

        switch (modal.units) {
            case 'G20':
                factor = grblReportingUnits === 0 ? 1 / 25.4 : 1.0;
                break;
            case 'G21':
                factor = grblReportingUnits === 0 ? 1.0 : 25.4;
                break;
        }

        mpos.x *= factor;
        mpos.y *= factor;
        mpos.z *= factor;
        mpos.a *= factor;

        wpos.x *= factor;
        wpos.y *= factor;
        wpos.z *= factor;
        wpos.a *= factor;

        if (typeof status.feedrate !== 'undefined') {
            velocity = status.feedrate * factor;
        } else if (typeof parserstate.feedrate !== 'undefined') {
            velocity = parserstate.feedrate * factor;
        }

        if (typeof status.spindle !== 'undefined') {
            spindleSpeed = status.spindle;
        } else if (typeof parserstate.spindle !== 'undefined') {
            spindleSpeed = parserstate.spindle;
        }
        spindleDirection = modal.spindle;

        feedOverride = status.ov[0];
        rapidOverride = status.ov[1] / 100.0;
        spindleOverride = status.ov[2];

        cnc.updateView();
    }

    controller.on('Grbl:state', function (data) {
        // If we do not yet know the reporting units from the $13 setting, we copy
        // the data for later processing when we do know.
        //if (typeof grblReportingUnits === 'undefined') {
        //    savedGrblState = JSON.parse(JSON.stringify(data));
        //} else {
        //    renderGrblState(data);
        //}
        renderGrblState(data);
    });

    controller.on('Grbl:settings', function (data) {
        var settings = data.settings || {};
        grblReportingUnits = 0;
        
        if (settings['$110'] !== undefined && settings['$111'] !== undefined && settings['$112'] !== undefined && settings['$113'] !== undefined) {
            maxFeedrate[0] = settings['$110'];
            maxFeedrate[1] = settings['$111'];
            maxFeedrate[2] = settings['$112'];
            maxFeedrate[3] = settings['$113'];
            
            document.getElementById('max-vel-x').value = Math.round(maxFeedrate[0]);
            document.getElementById('max-vel-y').value = Math.round(maxFeedrate[1]);
            document.getElementById('max-vel-z').value = Math.round(maxFeedrate[2]);
            document.getElementById('max-vel-a').value = Math.round(maxFeedrate[3]);
        }

        if (settings['$87'] !== undefined) {
            feedrate_reference = settings['$87'];
            document.getElementById('feedrate-reference').value = Math.round(feedrate_reference);
        }

        if (settings['$89'] !== undefined) {
            dynamic_reference = settings['$89'];
            document.getElementById('dynamic-reference').value = Math.round(dynamic_reference);
        }

        if (settings['$88'] !== undefined) {
            dynamic_scale_power = settings['$88'];
            document.getElementById('dynamic-power-scale').value = Math.round(dynamic_scale_power);
        }

        if (typeof savedGrblState !== 'undefined') {
            renderGrblState(savedGrblState);
            // Don't re-render the state if we get later settings reports,
            // as the savedGrblState is probably stale.
            savedGrblState = undefined;
        }
    });

    // Smoothie state and GRBL state are similar except for the overrides.
    // GRBL has ov: []  while Smootie has ovF and ovS.
    // Smoothie also has currentFeedrate and feedrateOverride

    controller.on('Smoothie:state', function (data) {
        var status = data.status || {};
        stateName = status.activeState;
        mpos = status.mpos;
        wpos = status.wpos;
        // Smoothie states are Idle, Run, Hold
        // canClick = stateName == 'Idle';
        stateName = setMachineWorkflow(stateName);

        var parserstate = data.parserstate || {};
        if (parserstate.modal) {
            Object.assign(modal, parserstate.modal);
        };

        // Smoothie reports both mpos and wpos in the current units
        // so no scaling is necessary

        // The following feedrate code is untested
        if (status.currentFeedrate) {
            velocity = status.currentFeedrate;
        } else if (status.feedrate) {
            velocity = status.currentFeedrate * status.feedrateOverride / 100.0;
        } else {
            velocity = parserstate.feedrate;
        }
        spindleSpeed = parserstate.spindle;
        spindleDirection = modal.spindle;

        spindleOverride = status.ovF / 100.0;
        rapidOverride = 1.0;
        feedOverride = status.ovS / 100.0;

        cnc.updateView();
    });

    controller.on('Marlin:state', function (data) {
        if (data.modal) {
            Object.assign(modal, data.modal);
        }
        velocity = data.feedrate;
        Object.assign(mpos, data.pos);

        // Marlin does not have a stalled state and it
        // does not report its actual state, so we move
        // to idle state automatically.
        if (!stateName || stateName == 'NoConnect') {
            machineWorkflow = MACHINE_IDLE;
            stateName = "Idle";
        }

        if (modal.units === 'G20') {
            // Marlin always reports position in mm
            mpos.x /= 25.4;
            mpos.y /= 25.4;
            mpos.z /= 25.4;
        }
        wpos = mpos;
        cnc.updateView();

        extruderTemperature = Number(data.extruder.deg || 0).toFixed(0);
        extruderTarget = Number(data.extruder.degTarget || 0).toFixed(0);
        $('[data-route="workspace"] [id="extruder-temperature"]').html(extruderTemperature + '&deg;C / ' + extruderTarget + "&deg;C");
    });

    controller.on('TinyG:state', function (data) {
        var sr = data.sr || {};
        var machineState = sr.machineState;
        var feedrate = sr.feedrate;

        velocity = sr.velocity || 0;
        spindleSpeed = sr.sps;
        spindleDirection = modal.spindle;
        stateName = {
            0: 'Init',
            1: 'Ready',
            2: 'Alarm',
            3: 'Pgm Stop',
            4: 'Pgm End',
            5: 'Run',
            6: 'Hold',
            7: 'Probe',
            8: 'Cycle',
            9: 'Homing',
            10: 'Jog',
            11: 'Interlock',
        }[machineState] || 'N/A';
        if (machineState == "") {
            return;
        }

        if (sr.modal) {
            Object.assign(modal, sr.modal);
        }
        mpos = sr.mpos;
        wpos = sr.wpos;
        var INIT = 0, READY = 1, ALARM = 2, STOP = 3, END = 4, RUN = 5,
            HOLD = 6, PROBE = 7, CYCLE = 8, HOMING = 9, JOG = 10, INTERLOCK = 11;
        if ([INIT, ALARM, INTERLOCK].indexOf(machineState) >= 0) {
            machineWorkflow = MACHINE_STALL;
        } else if ([END].indexOf(machineState) >= 0) {
            // MACHINE_STOP state happens only once at the end of the program,
            // then it switches to MACHINE_IDLE.  This permits the GCode viewer
            // to show that the program finished, but then lets the user scroll
            // around in the viewer.
            if (machineWorkflow == MACHINE_STOP) {
                machineWorkflow = MACHINE_IDLE;
                receivedLines = 0;
            } else {
                machineWorkflow = MACHINE_STOP;
            }
        } else if ([READY, STOP].indexOf(machineState) >= 0) {
            machineWorkflow = (machineState == STOP && workflowState == 'paused') ? MACHINE_HOLD : MACHINE_IDLE;
        } else if ([RUN, CYCLE, HOMING, PROBE, JOG].indexOf(machineState) >= 0) {
            machineWorkflow = MACHINE_RUN;
            running = true;
        } else {
            machineWorkflow = MACHINE_HOLD;
        }

        if (machineState == STOP) {
            if (userStopRequested) {
                // Manual stop
                userStopRequested = false;
                running = false;
                stateName = 'UserStop';
            } else {
                // Automatic stop at end of program or sequence
                if (running) {
                    if (senderHold) {
                        // If it is a hold condition like an M0 pause,
                        // the program has not ended so we go to hold
                        // state and do not clear the running variable.
                        machineWorkflow = MACHINE_HOLD;
                        stateName = senderHoldReason;
                        if (stateName == "M6") {
                            if (sr.tool) {
                                stateName += " T" + sr.tool;
                            }
                        }
                    } else {
                        // If it is a real stop instead of a hold,
                        // we clear running to show that the program is done.
                        running = false;
                    }
                }
            }
        }
        if (machineState == END) {
            running = false;
            if (userStopRequested) {
                // Manual stop
                userStopRequested = false;
                stateName = 'UserStop';
            } else if (oldState != END) {
                if (probing) {
                    probing = false;
                    if (oldFilename) {
                        controller.command('watchdir:load', oldFilename);
                        oldFilename = null;
                    }
                }
            }
        }
        oldState = machineState;

        switch (modal.units) {
            case 'G20':
                // TinyG reports machine coordinates in mm regardless of the in/mm mode
                mpos.x /= 25.4;
                mpos.y /= 25.4;
                mpos.z /= 25.4;
                break;
        }
        receivedLines = sr.line;

        // G2core now reports the overrides via properties
        // troe, tro, froe, fro, spoe, and spo, but as of this
        // writing the cncjs server uses the old properties
        // mfo and mto, and does not propagate the new properties
        spindleOverride = 1.0;
        rapidOverride = 1.0;
        feedOverride = 1.0;

        cnc.updateView();
    });

    setButton = function (name, isEnabled, color, text) {
        var button = $('[data-route="workspace"] .nav-panel ' + name);
        button.prop('disabled', !isEnabled);
        button.prop('style').backgroundColor = color;
        button.prop('innerText', text);
    }

    enableButtom = function (name, color, text) {
        var button = document.getElementById(name);
        button.disabled = false;
        button.style.backgroundColor = color;
        button.innerText = text;
    }

    disableButtom = function (name, text) {
        var button = document.getElementById(name);
        button.disabled = true;
        button.style.backgroundColor = '#f6f6f6';
        button.innerText = text;
    }

    var leftButtonHandler;
    setLeftButton = function (isEnabled, color, text, click) {
        setButton('.btn-start', isEnabled, color, text);
        leftButtonHandler = click;
    }
    cnc.doLeftButton = function () {
        if (leftButtonHandler) {
            leftButtonHandler();
        }
    }

    var rightButtonHandler;
    setRightButton = function (isEnabled, color, text, click) {
        setButton('.btn-pause', isEnabled, color, text);
        rightButtonHandler = click;
    }
    cnc.doRightButton = function () {
        if (rightButtonHandler) {
            rightButtonHandler();
        }
    }

    cnc.doSleepButton = function () {
        if (machineWorkflow == MACHINE_SLEEP) {
            cnc.controller.command('reset');
            cnc.controller.command('unlock');
        } else {
            cnc.controller.command('gcode', '$SLP');
            //setButton('.btn-pause', true, color, text);
        }
    }

    cnc.setJogSelector = function (units) {
        var distance = $('[data-route="workspace"] select[data-name="select-distance"]').val() || '10';

        var selector = $('[data-route="workspace"] select[data-name="select-distance"]');
        selector.empty();
        selector.append($("<option/>").text('0.05'));
        selector.append($("<option/>").text('0.1'));
        selector.append($("<option/>").text('0.2'));
        selector.append($("<option/>").text('0.5'));
        selector.append($("<option/>").text('1'));
        selector.append($("<option/>").text('3'));
        selector.append($("<option/>").text('5'));
        selector.append($("<option/>").text('10'));
        selector.append($("<option/>").text('30'));
        selector.append($("<option/>").text('50'));
        selector.append($("<option/>").text('100'));
        selector.append($("<option/>").text('300'));
        selector.append($("<option/>").text('600'));
        selector.val(distance);
    }

    cnc.updateView = function () {
        // if (cnc.filename == '') {
        //	canStart = false;
        //}
        
        cnc.updateSpindleFeedrate();

        grblReportingUnits = 0;

        var cannotClickJog = machineWorkflow > MACHINE_IDLE && machineWorkflow != MACHINE_RUN;
        $('[data-route="workspace"] .control-pad .jog-controls .btn').prop('disabled', cannotClickJog);
        $('[data-route="workspace"] .control-pad .form-control').prop('disabled', cannotClick);

        var cannotClick = machineWorkflow > MACHINE_IDLE;
        $('[data-route="workspace"] .mdi .btn').prop('disabled', cannotClick);
        $('[data-route="workspace"] .axis-position .btn').prop('disabled', cannotClick);
        $('[data-route="workspace"] .axis-position .position').prop('disabled', cannotClick);


        
        $('[data-route="workspace"] [id="max-vel-x"]').prop('disabled', cannotClick);
        $('[data-route="workspace"] [id="max-vel-y"]').prop('disabled', cannotClick);
        $('[data-route="workspace"] [id="max-vel-z"]').prop('disabled', cannotClick);
        $('[data-route="workspace"] [id="max-vel-a"]').prop('disabled', cannotClick);

        $('[data-route="workspace"] [id="feedrate-reference"]').prop('disabled', cannotClick);
        $('[data-route="workspace"] [id="dynamic-reference"]').prop('disabled', cannotClick);
        $('[data-route="workspace"] [id="dynamic-power-scale"]').prop('disabled', cannotClick);

        var cannotClickSleep = machineWorkflow == MACHINE_SLEEP;
        $('[data-route="workspace"] [id="hotwire-set"]').prop('disabled', cannotClickSleep);
        $('[data-route="workspace"] [id="hotwire-off"]').prop('disabled', cannotClickSleep);
        $('[data-route="workspace"] [id="hotwire-set-dyn"]').prop('disabled', cannotClickSleep);



        var newUnits = modal.units == 'G21' ? 'mm' : 'Inch';
        if ($('[data-route="workspace"] [id="units"]').text() != newUnits) {
            $('[data-route="workspace"] [id="units"]').text(newUnits);
            cnc.setJogSelector(newUnits);
        }
        // $('[data-route="workspace"] [id="units"]').text(modal.units == 'G21' ? 'mm' : 'Inch');
        $('[data-route="workspace"] [id="units"]').prop('disabled', cnc.controllerType == 'Marlin');

        var green = '#86f686';
        var red = '#f64646';
        var gray = '#f6f6f6';
        //console.log(machineWorkflow)
        switch (machineWorkflow) {
            case MACHINE_STALL:
                setLeftButton(true, gray, 'Start', null);
                setRightButton(false, gray, 'Pause', null);

                //allow reset
                enableButtom('reset-btn', 'white', 'Reset');
                //allow sleep
                enableButtom('sleep-btn', 'white', 'Sleep');
                //allow unloc
                enableButtom('unlock-btn', 'white', 'Unlock');
                break;
            case MACHINE_STOP:
            case MACHINE_IDLE:
                if (gCodeLoaded) {
                    // A GCode file is ready to go
                    setLeftButton(true, green, 'Start', zeroAndRunGCode);
                    setRightButton(false, gray, 'Pause', null);
                } else {
                    // Can't start because no GCode to run
                    setLeftButton(false, gray, 'Start', null);
                    setRightButton(false, gray, 'Pause', null);
                }
                //allow reset
                enableButtom('reset-btn', 'white', 'Reset');
                //allow sleep
                enableButtom('sleep-btn', 'white', 'Sleep');
                //dont allow unlock
                disableButtom('unlock-btn', 'Unlock');
                break;
            case MACHINE_HOLD:
                setLeftButton(true, green, 'Resume', resumeGCode);
                setRightButton(true, red, 'Stop', stopGCode);
                //allow reset
                enableButtom('reset-btn', 'white', 'Reset');
                //dont allow sleep
                disableButtom('sleep-btn', 'Sleep');
                //dont allow unlock
                disableButtom('unlock-btn', 'Unlock');
                break;
            case MACHINE_RUN:
                setLeftButton(false, gray, 'Start', null);
                setRightButton(true, red, 'Pause', pauseGCode);
                //allow reset
                enableButtom('reset-btn', 'white', 'Reset');
                //dont allow sleep
                disableButtom('sleep-btn', 'Sleep');
                //dont allow unlock
                disableButtom('unlock-btn', 'Unlock');
                break;
            case MACHINE_SLEEP:
                setLeftButton(false, gray, 'Start', null);
                setRightButton(false, gray, 'Pause', null);
                //dont allow reset
                disableButtom('reset-btn', 'Reset');
                //allow sleep
                enableButtom('sleep-btn', green, 'Wake');
                //dont allow unlock
                disableButtom('unlock-btn', 'Unlock');
                break;
            case MACHINE_ALARM:
                setLeftButton(false, gray, 'Start', null);
                setRightButton(false, gray, 'Pause', null);
                //allow reset
                enableButtom('reset-btn', 'white', 'Reset');
                //dont allow sleep
                disableButtom('sleep-btn', 'Sleep');
                //allow unlock
                enableButtom('unlock-btn', 'white', 'Unlock');
                break;
        }

        // Nonzero receivedLines is a good indicator of GCode execution
        // as opposed to jogging, etc.
        if (receivedLines && startTime) {
            var elapsed = new Date().getTime() - startTime;
            var elapsed = Math.max(elapsedTime, elapsed);
            if (elapsed < 0)
                elapsed = 0;
            var seconds = Math.floor(elapsed / 1000);
            var minutes = Math.floor(seconds / 60);
            seconds = seconds % 60;
            if (seconds < 10)
                seconds = '0' + seconds;
            runTime = minutes + ':' + seconds;
        } else {
            runTime = "0:00";
        }
        $('[data-route="workspace"] [id="runtime"]').text(runTime);

        $('[data-route="workspace"] [data-name="wpos-label"]').text(modal.wcs);
        var distanceText = modal.distance == 'G90'
            ? modal.distance
            : "<div style='color:red'>" + modal.distance + "</div>";
        $('[data-route="workspace"] [id="distance"]').html(distanceText);

        var stateText = stateName == 'Error' ? "Error" : stateName;

        document.getElementById('current-state').innerHTML = stateText;

        //document.getElementById('current-error').innerHTML = errorMessage;

        if (machineWorkflow == MACHINE_RUN || machineWorkflow == MACHINE_HOLD || machineWorkflow == MACHINE_STOP) {
            $('[data-route="workspace"] [id="line"]').text(receivedLines);
            scrollToLine(receivedLines);
        }

        if (!first_update){
            root.displayerL.reDrawToolL(modal, wpos);
            root.displayerR.reDrawToolR(modal, wpos);
        }

        first_update = false;

        var digits = modal.units == 'G20' ? 2 : 2;
        var dmpos = {
            x: Number(mpos.x).toFixed(digits),
            y: Number(mpos.y).toFixed(digits),
            z: Number(mpos.z).toFixed(digits),
            a: Number(mpos.a).toFixed(digits)
        };
        var dwpos = {
            x: Number(wpos.x).toFixed(digits),
            y: Number(wpos.y).toFixed(digits),
            z: Number(wpos.z).toFixed(digits),
            a: Number(wpos.a).toFixed(digits)
        };

        $('[data-route="workspace"] [id="wpos-x"]').prop('value', dwpos.x);
        $('[data-route="workspace"] [id="wpos-y"]').prop('value', dwpos.y);
        $('[data-route="workspace"] [id="wpos-z"]').prop('value', dwpos.z);
        $('[data-route="workspace"] [id="wpos-a"]').prop('value', dwpos.a);
    }

    controller.on('gcode:load', function (name, gcode) {
        // Force the line count display to update.  It normally does not
        // update in MACHINE_IDLE state because you don't want to change
        // the GCode display while jogging.
        var oldMachineWorkflow = machineWorkflow;
        machineWorkflow = MACHINE_STOP;
        receivedLines = 0;
        cnc.updateView();
        machineWorkflow = oldMachineWorkflow;

        cnc.showGCode(name, gcode);
        if (probing) {
            runGCode();
        }
    });

    controller.on('workflow:state', function (state) {
        switch (state) {
            case 'idle':
                cnc.line = 0;
                // Stop the probing: correct if not stopped the following load of a gcode file will start to run at loading
                probing = false;
                break;
            case 'paused': break;
            case 'running': break;
        }

        workflowState = state;
        // We do not update the view yet, because the workflow
        // messages reflect the state of the sender, not the
        // machine.  The machine state usually lags the workflow
        // state, often by a rather long time.  We want the UI
        // to be synchronized to the machine state, so user
        // interactions appear to control the machine directly,
        // without long queue delays.
        if (cnc.controllerType == 'Marlin') {
            switch (state) {
                case 'idle': machineWorkflow = MACHINE_IDLE; running = false; break;
                case 'paused': machineWorkflow = MACHINE_HOLD; break;
                case 'running': machineWorkflow = MACHINE_RUN; break;
            }
            cnc.updateView();
        }
    });

    controller.listAllPorts();

    // Close
    $('[data-route="connection"] [data-name="btn-close"]').on('click', function () {
        controller.closePort();
    });

    cnc.reConnect = function () {
        if (cnc.controllerType && cnc.port && cnc.baudrate) {
            controller.openPort(cnc.port, {
                controllerType: cnc.controllerType,
                baudrate: Number(cnc.baudrate)
            });
            return true;
        }
        return false;
    };

    cnc.runUserCommand = function (name) {
        jQuery.get("../api/commands", { token: cnc.token, paging: false }, function (data) {
            var cmd = data.records.find(function (record) {
                return record.enabled && record.title == name;
            });
            if (cmd) {
                //jQuery.post("../api/commands/run/" + cmd.id, {token: cnc.token});
                jQuery.post("../api/commands/run/" + cmd.id + "?token=" + cnc.token);
            }
        });
    }

    cnc.getFileList = function () {
        jQuery.get("../api/watch/files", { token: cnc.token, path: watchPath }, function (data) {
            var selector = $('[data-route="workspace"] select[data-name="select-file"]');
            var legend;
            selector.empty();
            data.files.sort(function (a, b) {
                return a.name.localeCompare(b.name);
            });
            if (watchPath === '') {
                legend = 'Load GCode File';
                selector.append($("<option disabled />").text(legend));
            } else {
                legend = 'In ' + watchPath;
                selector.append($("<option disabled />").text(legend));
                selector.append($("<option/>").text('..'));
            }

            $.each(data.files, function (index, file) {
                if (file.type === 'd') {
                    selector.append($("<option/>").text(file.name + '/'));
                }
            });
            $.each(data.files, function (index, file) {
                if (file.type === 'f' && !file.name.endsWith("~")) {
                    selector.append($("<option/>").text(file.name));
                }
            });
            var selected = cnc.filename.split('/').slice(-1)[0];
            if (selected == '')
                selected = legend;
            $('[data-route="workspace"] select[data-name="select-file"]').val(selected);
        }, "json");
    }

    cnc.sendFeedOverride = function (deltaPercent) {
        cnc.and('feedOverride', deltaPercent)
    }

    cnc.showGCode = function (name, gcode) {
        gCodeLoaded = gcode != '';
        if (!gCodeLoaded) {
            gcode = "(No GCode loaded)";
        }
        // $('[data-route="workspace"] .nav-panel .btn-start').prop('disabled', !gcodeLoaded);
        // $('[data-route="workspace"] .nav-panel .btn-start').prop('style').backgroundColor = gcodeLoaded ? '#86f686' : '#f6f6f6';

        cnc.filename = name;
        if (name != "") {
            // gcode = "(" + name + ")<br />" + gcode;
            var basename = name.split('/').slice(-1)[0];
            $('[data-route="workspace"] select[data-name="select-file"]').val(basename);
        } else {
            $('[data-route="workspace"] select[data-name="select-file"]')[0][0].selected = true;
        }
        $('[data-route="workspace"] [id="gcode"]').text(gcode);
        if (gCodeLoaded) {

            //console.log(wpos, "wpos2");
            root.displayerL.showToolpathL(gcode, wpos, mpos);
            root.displayerR.showToolpathR(gcode, wpos, mpos);
        }
        if (machineWorkflow != MACHINE_STALL) {
            cnc.updateView();
        }
    }

    cnc.getGCode = function () {
        jQuery.get("../api/gcode", { port: cnc.port }, function (res) {
            var gcode = res.data;
            cnc.showGCode("", gcode);
        });
    }

    cnc.loadGCode = function () {
        cnc.click();
        var filename = $('[data-route="workspace"] select[data-name="select-file"] option:selected')[0].text;
        if (filename === '..') {
            watchPath = watchPath.slice(0, -1).replace(/[^/]*$/, '');
            cnc.filename = '';
            cnc.getFileList();
        } else if (filename.endsWith('/')) {
            watchPath = watchPath + filename;
            cnc.filename = '';
            cnc.getFileList();
        } else {
            var path = watchPath + filename;

            controller.command('watchdir:load', path);
        }
    }

    $('[data-route="workspace"] select[data-name="select-file"]').change(cnc.loadGCode);

    function nthLineEnd(str, n) {
        if (n <= 0)
            return 0;
        var L = str.length, i = -1;
        while (n-- && i++ < L) {
            i = str.indexOf("\n", i);
            if (i < 0) break;
        }
        return i;
    }

    function scrollToLine(lineNumber) {
        var gCodeLines = $('[data-route="workspace"] [id="gcode"]');
        var lineHeight = parseInt(gCodeLines.css('line-height'));
        var gCodeText = gCodeLines.text();

        gCodeLines.scrollTop((lineNumber - 2) * lineHeight);
        gCodeLines.select();

        var start;
        var end;
        if (lineNumber <= 0) {
            start = 0;
            end = 1;
        } else {
            start = (lineNumber == 1) ? 0 : start = nthLineEnd(gCodeText, lineNumber - 1) + 1;
            end = gCodeText.indexOf("\n", start);
        }

        gCodeLines[0].selectionStart = start;
        gCodeLines[0].selectionEnd = end;
    }

    runGCode = function () {
        cnc.click();
        running = true;
        cnc.controller.command('gcode:start')
        startTime = new Date().getTime();
    }

    zeroAndRunGCode = function () {
        cnc.click();
        cnc.zeroAllAxes();
        running = true;
        cnc.controller.command('gcode:start')
        startTime = new Date().getTime();
    }

    pauseGCode = function () {
        cnc.click();
        cnc.controller.command('gcode:pause');
    }

    resumeGCode = function () {
        cnc.click();
        cnc.controller.command('gcode:resume');
    }

    stopGCode = function () {
        cnc.click();
        userStopRequested = true;
        cnc.controller.command('gcode:stop', { force: true })
    }

    cnc.probe = function () {
        oldFilename = cnc.filename;
        probing = true;
        controller.command('watchdir:load', "Probe.nc");
    }

    //
    // Connection
    //
    $('[data-route="connection"] [data-name="btn-open"]').on('click', function () {
        var controllerType = $('[data-route="connection"] [data-name="controllerType"]').val();
        var port = $('[data-route="connection"] [data-name="port"]').val();
        var baudrate = $('[data-route="connection"] [data-name="baudrate"]').val();

        // $('[data-route="connection"] [data-name="msg"]').html('Trying');
        if (port) {
            controller.openPort(port, {
                controllerType: controllerType,
                baudrate: Number(baudrate)
            });
        }
    }
    );

    //
    // Workspace
    //
    $('[data-route="workspace"] [data-name="btn-dropdown"]').dropdown();
    $('[data-route="workspace"] [data-name="active-state"]').text('-');
    $('[data-route="workspace"] select[data-name="select-distance"]').val('10');

    cycleDistance = function (up) {
        var selector = $('[data-route="workspace"] select[data-name="select-distance"]');
        var thisDistance = $('[data-route="workspace"] select[data-name="select-distance"] option:selected');
        var that = up ? thisDistance.next() : thisDistance.prev();
        var thatText = that.text();
        if (thatText) {
            cnc.click();
            selector.val(thatText);
        }
    }
    clickon = function (name) {
        $('[data-route="workspace"] .btn').removeClass('active');
        var button = $('[data-route="workspace"] ' + name);
        button.addClass('active');
        button.trigger('click');
    }
    var shiftDown = false;
    var ctrlDown = false;
    var altDown = false;
});
