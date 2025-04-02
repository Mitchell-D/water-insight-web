let state = {
    "menu_defaults":{
        "region":"conus",
        "res":"daily",
        "feat":"soilm-10",
        "metric":"mean",
    },
    // required onload
    "datamenu":null,
    "aux_feats":null,
    "aux_res":null,
    "latlon":null,
    "cmap":null,
    "borders":{
        "conus":null,
    },

    // currrently-selected menu options
    "sel_region":null,
    "sel_res":null,
    "sel_feat":null,
    "sel_metric":null,

    // provides available files given menu selection
    "datafeed":null,
    // initial and final buffer indeces
    "buf_ixs":null,
    "buf_ixf":null,

    // image buffer state
    "frozen":0,
    "image_buffer":{},
    "error_buffer":{},

    // image iteration
    "tick_active":null,
    "looping":false,
}

//const parser = new DOMParser();
const img_dir_url = "https://www.nsstc.uah.edu/data/mitchell.dodson/nldas2/rgbs/";
var cycle_handle = null;

let D = document;
let $t_time_res_radio = D.getElementById("radio_time_res_temp");
let $t_region_radio = D.getElementById("radio_region_temp");
let $t_menu_dropdown = D.getElementById("menu_dropdown");
let $t_ticker = D.getElementById("ticker_template");
let $main_canvas = D.getElementById("main_canvas");
//let $main_img = D.getElementById("main_img");
let $main_container_ticker = D.getElementById("main_container_ticker");
let $main_label_active = D.getElementById("main_label_active");
let $main_header_text = D.getElementById("main_header_text");
let $buffer_button_prev = D.getElementById("buffer_button_prev");
let $buffer_button_toggle = D.getElementById("buffer_button_toggle");
let $buffer_button_next = D.getElementById("buffer_button_next");
let $buffer_input_framedelay = D.getElementById("buffer_input_framedelay");
let $menu_container_region = D.getElementById("menu_container_region");
let $menu_container_timeres = D.getElementById("menu_container_timeres");
let $menu_container_feat = D.getElementById("menu_container_feat");
let $menu_container_metric = D.getElementById("menu_container_metric");
let $menu_container_vmin = D.getElementById("menu_container_vmin");
let $menu_container_vmax = D.getElementById("menu_container_vmax");
let $menu_dropdown_feat = D.getElementById("menu_dropdown_feat");
let $menu_dropdown_metric = D.getElementById("menu_dropdown_metric");
let $menu_date_range = D.getElementById("menu_date_range");
let $menu_submit_button = D.getElementById("menu_submit_button");
let $display_wrapper_inner = D.getElementById("display_wrapper_inner");

const main_ctx = $main_canvas.getContext("2d", {"alpha":false});
main_ctx.imageSmoothingEnabled = false;

const d3_main_svg = d3.select($display_wrapper_inner)
    .append("svg")
    .attr("width", $main_canvas.offsetWidth)
    .attr("height", $main_canvas.offsetHeight)
    .attr("id", "main_svg")
    .style("position", "absolute")
    .style("top", "0px")
    .style("left", "0px")
    .style("margin", "0px 12px");

let $main_svg = D.getElementById("main_svg");

/* ---------------( Menu Update Functions )--------------- */

/*
Use the menu to update all of the menu options from the time resolution down.
If this is the initial load, get the checked state from the menu defaults.

I don't think this should ever be called except for initial page load.
*/
function loadMenuRegion(initial_load=false){
    for (const k in state["datamenu"]) {
        let tmp_radio = $t_region_radio.content.cloneNode(true);
        tmp_radio.querySelector(".menu-radio-label-name").textContent = k;
        // set default value to checked per the menu state
        if (initial_load && (k==state["menu_defaults"]["region"])) {
            tmp_radio.querySelector(".menu-radio-checkbox").checked = true;
            state["sel_region"] = k;
        }
        tmp_radio.querySelector(".menu-radio-checkbox").value= k;
        tmp_radio.querySelector(".menu-radio-checkbox").onclick = function(v){
            state["sel_region"] = v.target.value;
            loadMenuTimeRes();
        }
        $menu_container_region.append(tmp_radio);
    }
    loadMenuTimeRes(initial_load);
}
function loadMenuTimeRes(initial_load=false){
    //for (const k in state["aux_res"]) {
    for (const k in state["datamenu"][state["sel_region"]]) {
        console.log(k);
        let tmp_radio = $t_time_res_radio.content.cloneNode(true);
        /*
        // load date
        let tmp_t0 = new Date(0);
        let tmp_tf = new Date(0);
        tmp_t0.setUTCSeconds(state["menu_time_res"][k]["init_time"] / 1000);
        tmp_tf.setUTCSeconds(state["menu_time_res"][k]["final_time"] / 1000);
        tmp_t0 = fmtDate(tmp_t0);
        tmp_tf = fmtDate(tmp_tf);
        let drange = `(${tmp_t0} - ${tmp_tf})`;
        tmp_radio.querySelector(".menu-radio-date-range").textContent = drange;
        */
        tmp_radio.querySelector(".menu-radio-label-name").textContent = cap(k);
        // set default value to checked per the menu state
        if (initial_load && (k==state["menu_defaults"]["res"])) {
            tmp_radio.querySelector(".menu-radio-checkbox").checked = true;
            state["sel_res"] = k;
        }
        tmp_radio.querySelector(".menu-radio-checkbox").value= k;
        tmp_radio.querySelector(".menu-radio-checkbox").onclick = function(v){
            state["sel_res"] = v.target.value;
            loadMenuDataFeats();
        }
        $menu_container_timeres.append(tmp_radio);
    }
    loadMenuDataFeats(initial_load);
}

// Load the data feats dropdown and set the current value
// behavior depends on the current time_res state.
function loadMenuDataFeats(initial_load=false) {
    let feats = state["datamenu"][state["sel_region"]][state["sel_res"]];
    $menu_container_feat.querySelector("ul").replaceChildren();
    for (fk in feats) {
        let tmp_dd = $t_menu_dropdown.content.cloneNode(true);
        let tmp_name = state["aux_feats"][fk]["short_title"];
        tmp_dd.querySelector(".dropdown-item").textContent = tmp_name;
        tmp_dd.querySelector("a").value = fk;
        tmp_dd.querySelector("a").onclick = function(v) {
            setDataFeatState(v.target.value);
        }
        $menu_container_feat.querySelector("ul").append(tmp_dd);
    }

    // on initial load, go with the universal default.
    if (initial_load){
        setDataFeatState(state["menu_defaults"]["feat"], true);
    }
    // if this method is called due to a change in time resolution...
    else {
        // if the previous feat is present for the new time resolution, keep it
        if (feats.hasOwnProperty(state["sel_feat"])) {
            setDataFeatState(state["sel_feat"], false);
        }
        // otherwise, go with the default feat for this time resolution
        else {
            let res_cfg = state["aux_res"][state["sel_res"]];
            setDataFeatState(res_cfg["default_feat"], false);
        }
    }
}

// establish a new sel_feat state, update the dropdown, and load the
// subsequent metrics available for the new feature.
function setDataFeatState(new_state, initial_load=false) {
    state["sel_feat"] = new_state;
    let tmp_title = state["aux_feats"][new_state]["short_title"];
    $menu_dropdown_feat.textContent = tmp_title;
    loadMenuDataMetrics(initial_load);
}

// load the metrics dropdown and set the current value;
// behavior depends on the current sel_feat state.
function loadMenuDataMetrics(initial_load=false) {
    let feats = state["datamenu"][state["sel_region"]][state["sel_res"]];
    let metrics = feats[state["sel_feat"]]
    let prev_metric_included = false;
    $menu_container_metric.querySelector("ul").replaceChildren();
    for (let tmpm of metrics) {
        let tmp_dd = $t_menu_dropdown.content.cloneNode(true);
        tmp_dd.querySelector(".dropdown-item").textContent = tmpm["name"];
        tmp_dd.querySelector("a").value = tmpm["name"];
        tmp_dd.querySelector("a").onclick = function(v){
            setDataMetricState(metrics.find((m) => m.name == v.target.value))
        }
        $menu_container_metric.querySelector("ul").append(tmp_dd);
        // record if this sel_feat has the same metric as previously selected
        if ((state["sel_metric"] != null)
            && (tmpm.name == state["sel_metric"]["name"])) {
            prev_metric_included = true;
        }
    }

    // on first load use the universal default metric
    let new_mname = null;
    if (initial_load){ new_mname = state["menu_defaults"]["metric"]; }
    // if called as a consequence of a change in sel_feat...
    else {
        // keep the previous metric if this sel_feat has it too
        if (prev_metric_included) { new_mname = state["sel_metric"].name; }
        // otherwise select the configured default metric for this sel_feat
        else { new_mname = state["aux_feats"][aux_feat["default_metric"]]; }
    }
    setDataMetricState(metrics.find((el) => el.name==new_mname));
}

function setDataMetricState(new_state) {
    state["sel_metric"] = new_state;
    $menu_dropdown_metric.textContent = new_state["name"];
    $menu_container_vmin.querySelector("input").value = new_state["vrange"][0];
    $menu_container_vmax.querySelector("input").value = new_state["vrange"][1];
    loadDataFeed();
}

function loadDataFeed(){
    // Use the current selection state to determine the datafeed to retrieve
    //feed_str = `${state["sel_res"]}_${state["sel_feat"]}_${state["sel_metric"]}`
    let feed_fields = [
        "datafeed",state["sel_region"],state["sel_res"],
        state["sel_feat"],state["sel_metric"].name
    ]
    let furl = `../listing/${feed_fields.join("_")}.json`
    // Fetch the datafeed JSON and update date selection and image buffer
    fetch(furl)
    .then((response) => {
        if (!response.ok) { throw new Error("Error acquiring "+furl); }
        return response.json();
    })
    .then(json =>{
        let dt = 60*60*24*7*6 // display 6 weeks initially
        state["datafeed"] = json;
        setFeedDateRange(json[0]["etime"], json[json.length-1]["etime"], dt);
    })
}

function setFeedDateRange(etime_init, etime_final, init_dt){
    // initial and final available times
    let t0 = new Date(0);
    let tf = new Date(0);
    // initial and final buffered times
    let bs = new Date(0);
    let bf = new Date(0);
    // set the time bounds of the full array
    t0.setUTCSeconds(etime_init);
    tf.setUTCSeconds(etime_final);
    // start with the default time bounds if no previous date range selected
    if ((state["buf_ts"] == null) || (state["buf_tf"] == null)){
        state["buf_ts"] = etime_final-init_dt;
        state["buf_tf"] = etime_final;
    }
    bs.setUTCSeconds(state["buf_ts"]);
    bf.setUTCSeconds(state["buf_tf"]);

    state["buf_ixs"] = getFirstFeedIndexAfter(state["buf_ts"]);
    state["buf_ixf"] = getLastFeedIndexBefore(state["buf_tf"]);
    $("#menu_date_range").daterangepicker({
        "showDropdowns": true,
        "minYear": t0.getFullYear(),
        "maxYear": tf.getFullYear(),
        "startDate": `${bs.getMonth()+1}/${bs.getDate()}/${bs.getFullYear()}`,
        "endDate": `${bf.getMonth()+1}/${bf.getDate()}/${bf.getFullYear()}`,
        "minDate": `${t0.getMonth()+1}/${t0.getDate()}/${t0.getFullYear()}`,
        "maxDate": `${tf.getMonth()+1}/${tf.getDate()}/${tf.getFullYear()}`,
    }, function(start, end, label){
        state["buf_ts"] = start.unix();
        state["buf_tf"] = end.unix();
        state["buf_ixs"] = getFirstFeedIndexAfter(state["buf_ts"], true);
        state["buf_ixf"] = getLastFeedIndexBefore(state["buf_tf"], true);
    });
}

function getFirstFeedIndexAfter(etime, inclusive=true) {
    let df = state["datafeed"]
    if (inclusive){
        if (df[df.length-1]["etime"]<etime){
            throw new Error("Provided time is after the entire buffer\n" +
                `${df[df.length-1]["etime"]} < ${etime}`);
        }
        for (let i in df) {
            if (df[i]["etime"] >= etime){ return i; }
        }
    }
    else{
        if (df[df.length-1]["etime"]<=etime){
            throw new Error("Provided time is after the entire buffer\n" +
                `${df[0]["etime"]} <= ${etime}`);
        }
        for (let i in df) {
            if (df[i] > etime){ return i; }
        }
    }
}

function getLastFeedIndexBefore(etime, inclusive=true) {
    let df = state["datafeed"]
    if (inclusive){
        if (df[0]["etime"]>etime){
            throw new Error("Provided time is before the entire buffer\n" +
                `${df[0]["etime"]} > ${etime}`);
        }
        for (let i in df) {
            if (df[df.length-i-1]["etime"] <= etime){ return df.length-i-1; }
        }
    }
    else{
        if (df[0]["etime"]>=etime){
            throw new Error("Provided time is before the entire buffer\n" +
                `${df[0]["etime"]} >= ${etime}`);
        }
        for (let i in df) {
            if (df[df.length-i] < etime){ return df.length-i-1; }
        }
    }
}

/* ---------------( Helper Functions )--------------- */

// generalized async function for getting the json files.
async function fetchJSON(path){
    const response = await fetch(path)
    if (!response.ok) {
      throw new Error("Error acquiring "+path)
    }
    return await response.json()
  }

function fmtDate(d, include_hours=true) {
    let s = d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
    s += include_hours ? " "+d.getHours()+":00" : "";
    return s
}

function cap(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

/* ---------------( Event Listeners )--------------- */

D.addEventListener("DOMContentLoaded", async function(){
    // acquire required data
    const listing = await Promise.all([
        fetchJSON("../listing/aux_datafeats.json"),
        fetchJSON("../listing/aux_timeres.json"),
        fetchJSON("../listing/datamenu.json"),
        fetchJSON("../listing/latlon.json"),
        fetchJSON("../listing/cmap_nipy-spectral.json"),
        fetchJSON("../listing/borders_conus.json")
    ]);
    state["aux_feats"] = listing[0];
    state["aux_res"] = listing[1];
    state["datamenu"] = listing[2];
    state["latlon"] = listing[3];
    state["cmap"] = listing[4];
    state["borders"]["conus"] = listing[5];
    //loadMenuTimeRes(true);
    loadMenuRegion(true);
    //d3.json("../listing/borders_conus.json", drawMap);
    redrawMap();
})

// always match the svg size to the canvas size.
window.onresize = function() {
    d3_main_svg.attr("width", $main_canvas.offsetWidth);
    d3_main_svg.attr("height", $main_canvas.offsetHeight);
    redrawMap();
  };

$buffer_button_next.addEventListener("click", () => { bufferStep(1); })
$buffer_button_prev.addEventListener("click", () => { bufferStep(-1); })
$buffer_button_toggle.addEventListener("click", () => { toggleBufferLoop(); })

$menu_submit_button.addEventListener("click", async ()=>{
    // Stop looping in order to load new data
    let was_looping = state["looping"];
    if (was_looping) { toggleBufferLoop(); }
    state["frozen"] += 1;
    $main_container_ticker.replaceChildren();
    state["image_buffer"] = {};
    let buf_urls = [];
    $main_header_text.innerText = [
        cap(state["sel_res"]),
        cap(state["sel_metric"]["name"]),
        state["aux_feats"][state["sel_feat"]]["long_title"],
        `(${state["aux_feats"][state["sel_feat"]]["unit"]})`,
    ].join(" ");
    for (let i=state["buf_ixs"] ; i<=state["buf_ixf"] ; i++) {
        let ticker = $t_ticker.content.querySelector("div").cloneNode(true);
        //let ticker = D.importNode($t_ticker.content.querySelector("div"));
        ticker.setAttribute("title", state["datafeed"][i]["stime"]);
        ticker.id = "ticker_" + state["datafeed"][i]["stime"];
        ticker.path = state["datafeed"][i]["fname"];
        ticker.addEventListener("click", (e) => {
            if (e.detail == 2) {
                console.log("activated");
                setActiveTicker(e.target.title);
            }
            else {
                console.log("toggled");
            }
        })
        $main_container_ticker.append(ticker);
        buf_urls.push({
            //"key":ticker.path,
            "key":ticker.title, // use title so shared between datasets
            "url":img_dir_url+state["datafeed"][i]["fname"],
            "bix":i-state["buf_ixs"],
        });
    }
    Promise.allSettled(buf_urls.map(getImagePromise)).then((v) => {
        state["frozen"] -= 1;
        // continue looping if the button was initially called while looping
        if (state["tick_active"] == null) {
            //setActiveTicker[buf_urls[buf_urls.length-1]["key"]];
            setActiveTicker(buf_urls[0]["key"]);
        }
        else {
            //
            let prev_active = buf_urls.find(
                (m) => m["key"] == state["tick_active"])
            if (prev_active == undefined) {
                setActiveTicker(buf_urls[0]["key"]);
            }
            else {
                setActiveTicker(prev_active["key"]);
            }
        }
        if (was_looping) { toggleBufferLoop(); }
    });
})

/* ---------------( Image Buffer Operations )--------------- */

function getImagePromise(key_url_bix){
    return new Promise((resolve, reject) => {
        let img = new Image();
        img.onload = () => {
            state["image_buffer"][key_url_bix["key"]] = {
                "url":key_url_bix["url"],
                "bix":key_url_bix["bix"],
                "img":img,
            }
            let ticker = $main_container_ticker.childNodes[key_url_bix["bix"]];
            ticker.classList.remove("buffer-ticker-disabled");
            ticker.classList.add("buffer-ticker-inactive");
            resolve();
        }
        img.onerror = () => {
            state["error_buffer"][key_url_bix["key"]] = {
                "url":key_url_bix["url"],
                "bix":key_url_bix["bix"],
                "img":img,
            };
            reject();
        }
        img.src = key_url_bix["url"];
    });
}

function setActiveTicker(tick_key){
    if ((state["tick_active"] != null)
            && (state["tick_active"] in state["image_buffer"])){
        let prev_bix = state["image_buffer"][state["tick_active"]]["bix"];
        let prev_tick = $main_container_ticker.childNodes[prev_bix];
        prev_tick.classList.remove("buffer-ticker-active");
        prev_tick.classList.add("buffer-ticker-inactive");
    }
    let buf = state["image_buffer"];
    let bix = state["image_buffer"][tick_key]["bix"];
    let tick = $main_container_ticker.childNodes[bix];
    tick.classList.remove("buffer-ticker-inactive");
    tick.classList.add("buffer-ticker-active");
    state["tick_active"] = tick_key;
    $main_label_active.innerText = tick_key;

    ///*
    main_ctx.drawImage(state["image_buffer"][tick_key]["img"],
        0, 0, $main_canvas.width, $main_canvas.height);
    //    */

    //D.getElementById("main_img").src = state["image_buffer"][tick_key]["img"].src;
}

function bufferStep(step=1) {
    if (state["tick_active"]==null){return;}
    let cur_ix = state["image_buffer"][state["tick_active"]]["bix"];
    let buf_size = $main_container_ticker.childNodes.length;
    let next_ix = (buf_size + cur_ix + step) % buf_size;
    setActiveTicker($main_container_ticker.childNodes[next_ix].title);
}

function toggleBufferLoop() {
    // Ignore toggle operations if images are loading
    if (state["frozen"] > 0){ return; }
    let fd = $buffer_input_framedelay.value;
    if (state["looping"]) {
        clearInterval(cycle_handle);
        cycle_handle = 0;
        state["looping"] = false;
    }
    else {
        cycle_handle = setInterval(()=>bufferStep(1), fd);
        state["looping"] = true;
    }
}

/* ---------------( D3JS stuff )--------------- */

function redrawMap() {
    d3_main_svg.selectAll("*").remove();
    let geo = state["borders"]["conus"];
    let d3_x = d3.scaleLinear()
        .domain(d3.extent(state["latlon"]["lon"]))
        .range([0,$main_svg.getAttribute("width")]);
    let d3_y = d3.scaleLinear()
        .domain(d3.extent(state["latlon"]["lat"]))
        .range([$main_svg.getAttribute("height"), 0]);

    let d3_proj = d3.geoTransform({
        point: function(px, py) { this.stream.point(d3_x(px), d3_y(py)); }
    });
    let d3_path = d3.geoPath(d3_proj);

    // make a group within the svg and get the border features from topojson
    // then for each of them, make a svg path with the path generator attached.
    d3_main_svg.append("g")
        .selectAll("path")
        .data(geo.features)
        .enter().append("path")
        .style("fill", "none")
        .style("stroke", "white")
        .attr("d", d3_path);
}

