let state = {
    "menu_defaults":{
        "res":"daily",
        "feat":"soilm-10",
        "metric":"mean",
    },
    // required onload
    "datamenu":null,
    "aux_feats":null,
    "aux_res":null,

    // currrently-selected menu options
    "sel_res":null,
    "sel_feat":null,
    "sel_metric":null,

    // provides available files given menu selection
    "datafeed":null,
    // initial and final buffer indeces
    "buf_ix0":null,
    "buf_ixf":null,

    // image buffer state
    "tick_position":null,
    "image_buffer":[],
}

const parser = new DOMParser();

let D = document
let $t_time_res_radio = D.getElementById("radio_time_res_temp");
let $t_menu_dropdown = D.getElementById("menu_dropdown");
let $t_ticker = D.getElementById("ticker_template");
let $main_ctx = D.getElementById("main_canvas");
let $main_container_ticker = D.getElementById("main_container_ticker");
let $main_label_active = D.getElementById("main_label_active");
let $menu_container_timeres = D.getElementById("menu_container_timeres");
let $menu_container_feat = D.getElementById("menu_container_feat");
let $menu_container_metric = D.getElementById("menu_container_metric");
let $menu_container_vmin = D.getElementById("menu_container_vmin");
let $menu_container_vmax = D.getElementById("menu_container_vmax");
let $menu_dropdown_feat = D.getElementById("menu_dropdown_feat");
let $menu_dropdown_metric = D.getElementById("menu_dropdown_metric");
let $menu_date_range = D.getElementById("menu_date_range");
let $menu_submit_button = D.getElementById("menu_submit_button");

/* ---------------( Menu Update Functions )--------------- */

/*
Use the menu to update all of the menu options from the time resolution down.
If this is the initial load, get the checked state from the menu defaults.

I don't think this should ever be called except for initial page load.
*/
function loadMenuTimeRes(initial_load=false){
    for (const k in state["aux_res"]) {
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
        tmp_radio.querySelector(".menu-radio-label-name").textContent = k
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
    let feats = state["datamenu"][state["sel_res"]];
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
    let metrics = state["datamenu"][state["sel_res"]][state["sel_feat"]];
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
        "datafeed",state["sel_res"],state["sel_feat"],state["sel_metric"].name
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
    let t0 = new Date(0);
    let tf = new Date(0);
    let ts = new Date(0);
    t0.setUTCSeconds(etime_init);
    tf.setUTCSeconds(etime_final);
    ts.setUTCSeconds((etime_final-init_dt)); // initial start time
    state["buf_ix0"] = getFirstFeedIndexAfter(etime_final-init_dt);
    state["buf_ixf"] = getLastFeedIndexBefore(etime_final);
    $("#menu_date_range").daterangepicker({
        "showDropdowns": true,
        "minYear": t0.getFullYear(),
        "maxYear": tf.getFullYear(),
        "startDate": `${ts.getMonth()+1}/${ts.getDate()}/${ts.getFullYear()}`,
        "endDate": `${tf.getMonth()+1}/${tf.getDate()}/${tf.getFullYear()}`,
        "minDate": `${t0.getMonth()+1}/${t0.getDate()}/${t0.getFullYear()}`,
        "maxDate": `${tf.getMonth()+1}/${tf.getDate()}/${tf.getFullYear()}`,
    }, function(start, end, label){
        state["buf_ix0"] = getFirstFeedIndexAfter(start.unix(), true);
        state["buf_ixf"] = getLastFeedIndexBefore(end.unix(), true);
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
async function fetchData(path){
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

/* ---------------( Event Listeners )--------------- */

D.addEventListener("DOMContentLoaded", async function(){
    const listing = await Promise.all([
        fetchData("../listing/aux_datafeats.json"),
        fetchData("../listing/aux_timeres.json"),
        fetchData("../listing/datamenu.json"),
    ]);
    state["aux_feats"] = listing[0];
    state["aux_res"] = listing[1];
    state["datamenu"] = listing[2];
    loadMenuTimeRes(true);
})

$menu_submit_button.addEventListener("click", async ()=>{
    $main_container_ticker.replaceChildren();
    for (let i=state["buf_ix0"] ; i<=state["buf_ixf"] ; i++) {
        let ticker = $t_ticker.content.cloneNode(true);
        ticker.title = state["datafeed"][i]["stime"];
        ticker.path = state["datafeed"][i]["fname"];
        ticker.addEventListener("click", (e) => {
            if (e.detail == 2) {
                console.log("activated");
                console.log(e.target);
            }
            else {
                console.log("toggled");
                console.log(e.target);
            }
        })
        $main_container_ticker.append(ticker);
        console.log("loading "+state["datafeed"][i]["stime"]);
    }
})