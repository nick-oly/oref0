var basal = require('oref0/lib/profile/basal');
var get_iob = require('oref0/lib/iob');

function detectSensitivityandCarbAbsorption(inputs) {

    glucose_data = inputs.glucose_data;
    iob_inputs = inputs.iob_inputs;
    basalprofile = inputs.basalprofile;
    profile = inputs.iob_inputs.profile;

    var avgDeltas = [];
    var bgis = [];
    var deviations = [];
    var deviationSum = 0;
    for (var i=0; i < glucose_data.length-3; ++i) {
        //console.log(glucose_data[i]);
        var bgTime;
        if (glucose_data[i].display_time) {
            bgTime = new Date(glucose_data[i].display_time.replace('T', ' '));
        } else if (glucose_data[i].dateString) {
            bgTime = new Date(glucose_data[i].dateString);
        } else { console.error("Could not determine last BG time"); }
        //console.log(bgTime);
        var bg = glucose_data[i].glucose;
        if ( bg < 40 || glucose_data[i+3].glucose < 40) {
            process.stderr.write("!");
            continue;
        }
        var avgDelta = (bg - glucose_data[i+3].glucose)/3;
        avgDelta = avgDelta.toFixed(2);
        iob_inputs.clock=bgTime;
        iob_inputs.profile.current_basal = basal.basalLookup(basalprofile, bgTime);
        //console.log(JSON.stringify(iob_inputs.profile));
        var iob = get_iob(iob_inputs);
        //console.log(JSON.stringify(iob));

        var bgi = -iob.activity*profile.sens;
        bgi = bgi.toFixed(2);
        deviation = avgDelta-bgi;
        deviation = deviation.toFixed(2);
        //if (deviation < 0 && deviation > -2) {
            //console.log("BG: "+bg+", avgDelta: "+avgDelta+", BGI: "+bgi+", deviation: "+deviation);
        //}
        process.stderr.write(".");

        avgDeltas.push(avgDelta);
        bgis.push(bgi);
        deviations.push(deviation);
        deviationSum += parseFloat(deviation);

    }
    console.error("");
    //console.log(JSON.stringify(avgDeltas));
    //console.log(JSON.stringify(bgis));
    avgDeltas.sort(function(a, b){return a-b});
    bgis.sort(function(a, b){return a-b});
    deviations.sort(function(a, b){return a-b});
    for (var i=0.51; i > 0.29; i = i - 0.01) {
        console.error("p="+i.toFixed(2)+": "+percentile(avgDeltas, i).toFixed(2)+", "+percentile(bgis, i).toFixed(2)+", "+percentile(deviations, i).toFixed(2));
    }
    p50 = percentile(deviations, 0.5);
    p45 = percentile(deviations, 0.45);
    //p30 = percentile(deviations, 0.3);

    average = deviationSum / deviations.length;

    console.error("Mean deviation: "+average.toFixed(2));
    var basalOff = 0;

    if(p50 < 0) { // sensitive
        basalOff = p50 * (60/5) / profile.sens;
        console.error("Excess insulin sensitivity detected");
    } else if (p45 > 0) { // resistant
        basalOff = p45 * (60/5) / profile.sens;
        console.error("Excess insulin resistance detected");
    } else {
        console.error("Sensitivity within normal ranges");
    }
    ratio = 1 + (basalOff / profile.max_daily_basal);
    ratio = Math.round(ratio*100)/100
    newisf = profile.sens / ratio;
    console.error("Basal adjustment "+basalOff.toFixed(2)+"U/hr");
    console.error("Ratio: "+ratio*100+"%: new ISF: "+newisf.toFixed(1)+"mg/dL/U");
    var output = {
        "ratio": ratio
    }
    return console.log(JSON.stringify(output));
}
module.exports = detectSensitivityandCarbAbsorption;

// From https://gist.github.com/IceCreamYou/6ffa1b18c4c8f6aeaad2
// Returns the value at a given percentile in a sorted numeric array.
// "Linear interpolation between closest ranks" method
function percentile(arr, p) {
    if (arr.length === 0) return 0;
    if (typeof p !== 'number') throw new TypeError('p must be a number');
    if (p <= 0) return arr[0];
    if (p >= 1) return arr[arr.length - 1];

    var index = arr.length * p,
        lower = Math.floor(index),
        upper = lower + 1,
        weight = index % 1;

    if (upper >= arr.length) return arr[lower];
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}

// Returns the percentile of the given value in a sorted numeric array.
function percentRank(arr, v) {
    if (typeof v !== 'number') throw new TypeError('v must be a number');
    for (var i = 0, l = arr.length; i < l; i++) {
        if (v <= arr[i]) {
            while (i < l && v === arr[i]) i++;
            if (i === 0) return 0;
            if (v !== arr[i-1]) {
                i += (v - arr[i-1]) / (arr[i] - arr[i-1]);
            }
            return i / l;
        }
    }
    return 1;
}
