/*
Fake JSON objects imitating GET responses for forms

data_features' vrange bounds for 'total' metrics should refer to the bounds
on total per _hour_, where the number of hours per time resolution is given
by the nhours fields
*/

const ctx = document.getElementById("main_data_render")
const parser = new DOMParser();

let state = {
    "menu_defaults":{
        "time_resolution":"Daily",
        "data_feat":"soilm-10",
        "data_metric":"mean",
    },
    "menu_time_res":null,
    "menu_data_feats":null,
    "time_resolution":null,
    "data_feat":null,
    "data_metric":null,
    "tick_position":null,
    "image_buffer":[],
}

let D = document

let $t_time_res_radio = D.getElementById("radio_time_res_temp");
let $t_menu_dropdown = D.getElementById("menu_dropdown");
let $menu_container_timeres = D.getElementById("menu_container_timeres");
let $menu_container_feat = D.getElementById("menu_container_feat");
let $menu_container_metric = D.getElementById("menu_container_metric");
let $menu_container_vmin = D.getElementById("menu_container_vmin");
let $menu_container_vmax = D.getElementById("menu_container_vmax");
let $menu_dropdown_feat = D.getElementById("menu_dropdown_feat");
let $menu_dropdown_metric = D.getElementById("menu_dropdown_metric");

function captureSettings(){
}

function fmtDate(d, include_hours=true) {
    let s = d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
    s += include_hours ? " "+d.getHours()+":00" : "";
    return s
}

/* DOM update functions */

/*
Use the menu to update all of the menu options from the time resolution down.
If this is the initial load, get the checked state from the menu defaults.

I don't think this should ever be called except for initial page load.
*/
function loadMenuTimeRes(initial_load=false){
    for (const k in state["menu_time_res"]) {
        let tmp_radio = $t_time_res_radio.content.cloneNode(true);
        let tmp_t0 = new Date(0);
        let tmp_tf = new Date(0);
        tmp_t0.setUTCSeconds(state["menu_time_res"][k]["init_time"] / 1000);
        tmp_tf.setUTCSeconds(state["menu_time_res"][k]["final_time"] / 1000);
        tmp_t0 = fmtDate(tmp_t0);
        tmp_tf = fmtDate(tmp_tf);
        let drange = `(${tmp_t0} - ${tmp_tf})`;
        tmp_radio.querySelector(".menu-radio-label-name").textContent = k
        tmp_radio.querySelector(".menu-radio-date-range").textContent = drange;
        // set default value to checked per the menu state
        if (initial_load && (k==state["menu_defaults"]["time_resolution"])) {
            tmp_radio.querySelector(".menu-radio-checkbox").checked = true;
            state["time_resolution"] = k;
        }
        tmp_radio.querySelector(".menu-radio-checkbox").value= k;
        tmp_radio.querySelector(".menu-radio-checkbox").onclick = function(v){
            state["time_resolution"] = v.target.value;
            loadMenuDataFeats();
        }
        $menu_container_timeres.append(tmp_radio);
    }
    loadMenuDataFeats(initial_load);
}

// Load the data feats dropdown and set the current value
// behavior depends on the current time_res state.
function loadMenuDataFeats(initial_load=false) {
    let tr = state["menu_time_res"][state["time_resolution"]];
    $menu_container_feat.querySelector("ul").replaceChildren();
    for (fk of tr["data_features"]) {
        let tmp_dd = $t_menu_dropdown.content.cloneNode(true);
        let tmp_name = state["menu_data_feats"][fk]["short_title"];
        tmp_dd.querySelector(".dropdown-item").textContent = tmp_name;
        tmp_dd.querySelector("a").value = fk;
        tmp_dd.querySelector("a").onclick = function(v) {
            setDataFeatState(v.target.value);
        }
        $menu_container_feat.querySelector("ul").append(tmp_dd);
    }
    // on initial load, go with the universal default.
    if (initial_load){
        setDataFeatState(state["menu_defaults"]["data_feat"], true);
    }
    // if this method is called due to a change in time resolution...
    else {
        // if the previous feat is present for the new time resolution, keep it
        if (tr["data_features"].includes(state["data_feat"])) {
            setDataFeatState(state["data_feat"], false);
        }
        // otherwise, go with the default feat for this time resolution
        else {
            setDataFeatState(tr["default_feat"], false);
        }
    }
}

// establish a new data_feat state, update the dropdown, and load the
// subsequent metrics available for the new feature.
function setDataFeatState(new_state, initial_load=false) {
    state["data_feat"] = new_state;
    let tmp_title = state["menu_data_feats"][new_state]["short_title"];
    $menu_dropdown_feat.textContent = tmp_title;
    loadMenuDataMetrics(initial_load);
}

// load the metrics dropdown and set the current value;
// behavior depends on the current data_feat state.
function loadMenuDataMetrics(initial_load=false) {
    let tmp_df = state["menu_data_feats"][state["data_feat"]];
    let prev_metric_included = false;
    $menu_container_metric.querySelector("ul").replaceChildren();
    for (metric of tmp_df["metrics"]) {
        let tmp_dd = $t_menu_dropdown.content.cloneNode(true);
        tmp_dd.querySelector(".dropdown-item").textContent = metric["name"];
        tmp_dd.querySelector("a").value = metric["name"];
        tmp_dd.querySelector("a").onclick = function(v){
            setDataMetricState(
                state["menu_data_feats"][state["data_feat"]]["metrics"].find(
                    (m) => m.name == v.target.value
                )
            )
        }
        $menu_container_metric.querySelector("ul").append(tmp_dd);
        // record if this data_feat has the same metric as previously selected
        if ((state["data_metric"] != null)
            && (metric.name == state["data_metric"]["name"])) {
            prev_metric_included = true;
        }
    }
    // on first load use the universal default metric
    if (initial_load){
        let tmpm = tmp_df["metrics"].find(
            (m) => m.name==state["menu_defaults"]["data_metric"]
        )
        setDataMetricState(tmpm);
    }
    // if called as a consequence of a change in data_feat...
    else {
        // keep the previous metric if this data_feat has it too
        if (prev_metric_included) {
            setDataMetricState(state["data_metric"]);
        }
        // otherwise select the configured default metric for this data_feat
        else {
            let def_metric = tmp_df["metrics"].find(
                (el)=>el.name==tmp_df["default_metric"]);
            setDataMetricState(def_metric);
        }
    }
}

function setDataMetricState(new_state) {
    state["data_metric"] = new_state;
    $menu_dropdown_metric.textContent = new_state["name"];
    $menu_container_vmin.querySelector("input").value = new_state["vrange"][0];
    $menu_container_vmax.querySelector("input").value = new_state["vrange"][1];
}

/* Event listeners */
D.addEventListener("DOMContentLoaded", function(){
    fetch("data_menu.json")
    .then((response)=>{
        return response.json();
    })
    .then(json => {
        state["menu_time_res"] = json["time_resolutions"];
        state["menu_data_feats"] = json["data_features"];
        loadMenuTimeRes(true);
        //updateMenuTimeResolutions(json["time_resolutions"], true);
        //updateMenuDataFeatures(json["data_features"], true);
    });
})