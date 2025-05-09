import json
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
from datetime import datetime
from collections import OrderedDict

aux_datafeats = {
        "weasd":{
            "long_title":"Snow Water Equivalent",
            "short_title":"SWE",
            "unit":"kg / m^2",
            "default_metric":"mean",
            },
        "soilm-10":{
            "long_title":"0-10cm Volumetric Soil Moisture",
            "short_title":"0-10cm VSM",
            "unit":"kg / m^2",
            "default_metric":"mean",
            },
        "soilm-40":{
            "long_title":"10-40cm Volumetric Soil Moisture",
            "short_title":"10-40cm VSM",
            "unit":"kg / m^2",
            "default_metric":"mean",
            },
        "soilm-100":{
            "long_title":"40-100cm Volumetric Soil Moisture",
            "short_title":"40-100cm VSM",
            "unit":"kg / m^2",
            "default_metric":"mean",
            },
        "soilm-200":{
            "long_title":"100-200cm Volumetric Soil Moisture",
            "short_title":"100-200cm VSM",
            "unit":"kg / m^2",
            "default_metric":"mean",
            },
        "rsm-10":{
            "long_title":"0-10cm Relative Soil Moisture",
            "short_title":"0-10cm RSM",
            "unit":"%",
            "default_metric":"mean",
            },
        "rsm-40":{
            "long_title":"10-40cm Relative Soil Moisture",
            "short_title":"10-40cm RSM",
            "unit":"%",
            "default_metric":"mean",
            },
        "rsm-100":{
            "long_title":"40-100cm Relative Soil Moisture",
            "short_title":"40-100cm RSM",
            "unit":"%",
            "default_metric":"mean",
            },
        "rsm-200":{
            "long_title":"100-200cm Relative Soil Moisture",
            "short_title":"100-200cm RSM",
            "unit":"%",
            "default_metric":"mean",
            },
        "apcp":{
            "long_title":"Precipitation Area Density",
            "short_title":"Precip",
            "unit":"kg / m^2",
            "default_metric":"total",
            },
        "evbs":{
            "long_title":"Bare Surface Evaporation",
            "short_title":"Evaporation",
            "unit":"W / m^2",
            "default_metric":"mean",
            },
        "trans":{
            "long_title":"Plant Transpiration",
            "short_title":"Transpiration",
            "unit":"W / m^2",
            "default_metric":"mean",
            },
        "ssrun":{
            "long_title":"Surface Runoff",
            "short_title":"Surface Runoff",
            "unit":"kg / m^2",
            "default_metric":"total",
            },
        "bgrun":{
            "long_title":"Subsurface Runoff",
            "short_title":"Subsurface Runoff",
            "unit":"kg / m^2",
            "default_metric":"total",
            },
        }

aux_timeres = {
        "daily":{
            "nhours":24,
            "init_time":None,
            "final_time":None,
            "default_feat":"soilm-10",
            },
        }

feat_order = [
        "apcp", "weasd",
        "soilm-10", "soilm-40", "soilm-100", "soilm-200",
        "ssrun", "bgrun", "trans", "evbs",
        "rsm-10", "rsm-40", "rsm-100", "rsm-200",
        ]

metric_order = ["mean", "min", "max", "stdev", "sum-or-diff"]

if __name__=="__main__":
    image_dir = Path("/rstor/mdodson/timegrid_frames/rgbs")
    feed_dir = Path("/rhome/mdodson/water-insight-web/resources/listing")
    default_norm_path = feed_dir.joinpath("cmap_default_norms.json")
    def_norms = json.load(default_norm_path.open("r"))

    ## collect a tree of all available images according to their time
    ## resolution, data feature, and data metric.
    #'''
    feed = {}
    for p in image_dir.iterdir():
        _,rl,tl,stime,fl,ml = p.stem.split("_")
        if rl not in feed.keys():
            feed[rl] = {}
        if tl not in feed[rl].keys():
            feed[rl][tl] = {}
        if fl not in feed[rl][tl].keys():
            feed[rl][tl][fl] = {}
        if ml not in feed[rl][tl][fl].keys():
            feed[rl][tl][fl][ml] = []#{"etimes":[], "paths":[], "stimes":[]}

        etime = datetime.strptime(stime,"%Y%m%d").strftime("%s")
        feed[rl][tl][fl][ml].append(
                {"etime":etime,"stime":stime,"fname":p.name})

    ## generate datafeed json for each resolution/feature/metric combo
    ## and a single menu json with default norm bounds for all combos
    menu = OrderedDict()
    for rl in feed.keys():
        if rl not in menu.keys():
            menu[rl] = OrderedDict()
        for tl in feed[rl].keys():
            if tl not in menu[rl].keys():
                menu[rl][tl] = OrderedDict()
            for fl in sorted(list(feed[rl][tl].keys()),
                    key=lambda k:feat_order.index(k)):
                menu[rl][tl][fl] = []
                for ml in sorted(list(feed[rl][tl][fl].keys()),
                        key=lambda k:metric_order.index(k)):
                    available = sorted(
                            feed[rl][tl][fl][ml],
                            key=lambda s:s["etime"]
                            )
                    feed_path = feed_dir.joinpath(
                            f"datafeed_{rl}_{tl}_{fl}_{ml}.json")
                    json.dump(available, feed_path.open("w"))
                    print(f"Generated {feed_path.as_posix()}")
                    menu[rl][tl][fl].append({
                        "name":ml,
                        "vrange":def_norms[fl][ml],
                        "res":(195,462), ## image resolution
                        "fill":(64,64,64), ## mask color (rgb)
                        })
    json.dump(menu, feed_dir.joinpath("datamenu.json").open("w"))
    #'''

    ## generate JSON files for the static auxiliary information
    #'''
    json.dump(aux_datafeats, feed_dir.joinpath("aux_datafeats.json").open("w"))
    json.dump(aux_timeres, feed_dir.joinpath("aux_timeres.json").open("w"))
    #'''

    ## ugly way to get color map jsons with unique values at each point
    '''
    cmaps = ["nipy_spectral", "gnuplot", "gnuplot2", "gist_rainbow",
            "gist_earth", "coolwarm", "inferno", "viridis"]
    for cm in cmaps:
        res = 512
        while True:
            ca = plt.get_cmap(cm)(
                    np.linspace(0,1, res),
                    bytes=True,
                    )[:,:3].astype(int)
            ca = [tuple(ca[i,:]) for i in range(ca.shape[0])]
            if len(ca) == len(set(ca)):
                break
            res -= 1
        cmjson = {
                "name":cm,
                "map":[list(map(int,x)) for x in ca],
                "mins":[int(x) for x in np.amin(ca, axis=0)],
                "maxs":[int(x) for x in np.amax(ca, axis=0)],
                }
        print(f"saving {cm} with resolution {res}")
        json.dump(cmjson, feed_dir.joinpath(
            f"cmap_{cm.replace('_','-')}.json").open("w"))
    '''
