// ==UserScript==
// @id             iitc-plugin-portals-list@teo96
// @name           IITC plugin: show list of portals
// @category       Info
// @version        0.2.1.20150227.5821
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://secure.jonatkins.com/iitc/release/plugins/portals-list.meta.js
// @downloadURL    https://secure.jonatkins.com/iitc/release/plugins/portals-list.user.js
// @description    [jonatkins-2015-02-27-005821] Display a sortable list of all visible portals with full details about the team, resonators, links, etc.
// @include        https://www.ingress.com/intel*
// @include        http://www.ingress.com/intel*
// @match          https://www.ingress.com/intel*
// @match          http://www.ingress.com/intel*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'jonatkins';
plugin_info.dateTimeVersion = '20150227.5821';
plugin_info.pluginId = 'portals-list';
//END PLUGIN AUTHORS NOTE



// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.agenteights = function() {};

window.plugin.agenteights.listPortals = [];
window.plugin.agenteights.sortBy = 1; // second column: level
window.plugin.agenteights.sortOrder = -1;
window.plugin.agenteights.enlP = 0;
window.plugin.agenteights.resP = 0;
window.plugin.agenteights.neuP = 0;
window.plugin.agenteights.filter = 0;

/*
 * plugins may add fields by appending their specifiation to the following list. The following members are supported:
 * title: String
 *     Name of the column. Required.
 * value: function(portal)
 *     The raw value of this field. Can by anything. Required, but can be dummy implementation if sortValue and format
 *     are implemented.
 * sortValue: function(value, portal)
 *     The value to sort by. Optional, uses value if omitted. The raw value is passed as first argument.
 * sort: function(valueA, valueB, portalA, portalB)
 *     Custom sorting function. See Array.sort() for details on return value. Both the raw values and the portal objects
 *     are passed as arguments. Optional. Set to null to disable sorting
 * format: function(cell, portal, value)
 *     Used to fill and format the cell, which is given as a DOM node. If omitted, the raw value is put in the cell.
 * defaultOrder: -1|1
 *     Which order should by default be used for this column. -1 means descending. Default: 1
 */


window.plugin.agenteights.fields = [
  {
    title: "Portal Name",
    value: function(portal) { return portal.options.data.title; },
    sortValue: function(value, portal) { return value.toLowerCase(); },
    format: function(cell, portal, value) {
      $(cell)
        .append(plugin.agenteights.getPortalLink(portal))
        .addClass("portalTitle");
    }
  },
  {
    title: "Level",
    value: function(portal) { return portal.options.data.level; },
    format: function(cell, portal, value) {
      $(cell)
        .css('background-color', COLORS_LVL[value])
        .text('L' + value);
    },
    defaultOrder: -1,
  },
  {
    title: "Team",
    value: function(portal) { return portal.options.team; },
    format: function(cell, portal, value) {
      $(cell).text(['NEU', 'RES', 'ENL'][value]);
    }
  },
  {
    title: "Health",
    value: function(portal) { return portal.options.data.health; },
    sortValue: function(value, portal) { return portal.options.team===TEAM_NONE ? -1 : value; },
    format: function(cell, portal, value) {
      $(cell)
        .addClass("alignR")
        .text(portal.options.team===TEAM_NONE ? '-' : value+'%');
    },
    defaultOrder: -1,
  },
  {
    title: "Res",
    value: function(portal) { return portal.options.data.resCount; },
    format: function(cell, portal, value) {
      $(cell)
        .addClass("alignR")
        .text(value);
    },
    defaultOrder: -1,
  },
  {
    title: "Links",
    value: function(portal) { return window.getPortalLinks(portal.options.guid); },
    sortValue: function(value, portal) { return value.in.length + value.out.length; },
    format: function(cell, portal, value) {
      $(cell)
        .addClass("alignR")
        .addClass('help')
        .attr('title', 'In:\t' + value.in.length + '\nOut:\t' + value.out.length)
        .text(value.in.length+value.out.length);
    },
    defaultOrder: -1,
  },
  {
    title: "Fields",
    value: function(portal) { return getPortalFieldsCount(portal.options.guid) },
    format: function(cell, portal, value) {
      $(cell)
        .addClass("alignR")
        .text(value);
    },
    defaultOrder: -1,
  },
  {
    title: "AP",
    value: function(portal) {
      var links = window.getPortalLinks(portal.options.guid);
      var fields = getPortalFieldsCount(portal.options.guid);
      return portalApGainMaths(portal.options.data.resCount, links.in.length+links.out.length, fields);
    },
    sortValue: function(value, portal) { return value.enemyAp; },
    format: function(cell, portal, value) {
      var title = '';
      if (teamStringToId(PLAYER.team) == portal.options.team) {
        title += 'Friendly AP:\t'+value.friendlyAp+'\n'
               + '- deploy '+(8-portal.options.data.resCount)+' resonator(s)\n'
               + '- upgrades/mods unknown\n';
      }
      title += 'Enemy AP:\t'+value.enemyAp+'\n'
             + '- Destroy AP:\t'+value.destroyAp+'\n'
             + '- Capture AP:\t'+value.captureAp;

      $(cell)
        .addClass("alignR")
        .addClass('help')
        .prop('title', title)
        .html(digits(value.enemyAp));
    },
    defaultOrder: -1,
  },
];

//fill the listPortals array with portals avaliable on the map (level filtered portals will not appear in the table)
window.plugin.agenteights.getPortals = function() {
  //filter : 0 = All, 1 = Neutral, 2 = Res, 3 = Enl, -x = all but x
  var retval=false;

  var displayBounds = map.getBounds();

  window.plugin.agenteights.listPortals = [];
  $.each(window.portals, function(i, portal) {
    // eliminate offscreen portals (selected, and in padding)
    if(!displayBounds.contains(portal.getLatLng())) return true;

    retval=true;

    switch (portal.options.team) {
      case TEAM_RES:
        window.plugin.agenteights.resP++;
        break;
      case TEAM_ENL:
        window.plugin.agenteights.enlP++;
        break;
      default:
        window.plugin.agenteights.neuP++;
    }

    // cache values and DOM nodes
    var obj = { portal: portal, values: [], sortValues: [] };

    var row = document.createElement('tr');
    row.className = TEAM_TO_CSS[portal.options.team];
    obj.row = row;

    var cell = row.insertCell(-1);
    cell.className = 'alignR';

    window.plugin.agenteights.fields.forEach(function(field, i) {
      cell = row.insertCell(-1);

      var value = field.value(portal);
      obj.values.push(value);

      obj.sortValues.push(field.sortValue ? field.sortValue(value, portal) : value);

      if(field.format) {
        field.format(cell, portal, value);
      } else {
        cell.textContent = value;
      }
    });

    window.plugin.agenteights.listPortals.push(obj);
  });

  return retval;
}

window.plugin.agenteights.displayPL = function() {
  var list;
  // plugins (e.g. bookmarks) can insert fields before the standard ones - so we need to search for the 'level' column
  window.plugin.agenteights.sortBy = window.plugin.agenteights.fields.map(function(f){return f.title;}).indexOf('Level');
  window.plugin.agenteights.sortOrder = -1;
  window.plugin.agenteights.enlP = 0;
  window.plugin.agenteights.resP = 0;
  window.plugin.agenteights.neuP = 0;
  window.plugin.agenteights.filter = 0;

  if (window.plugin.agenteights.getPortals()) {
    list = window.plugin.agenteights.portalTable(window.plugin.agenteights.sortBy, window.plugin.agenteights.sortOrder,window.plugin.agenteights.filter);
  } else {
    list = $('<table class="noPortals"><tr><td>Nothing to show!</td></tr></table>');
  };

  if(window.useAndroidPanes()) {
    $('<div id="agenteights" class="mobile">').append(list).appendTo(document.body);
  } else {
    dialog({
      html: $('<div id="agenteights">').append(list),
      dialogClass: 'ui-dialog-agenteights',
      title: 'Portal list: ' + window.plugin.agenteights.listPortals.length + ' ' + (window.plugin.agenteights.listPortals.length == 1 ? 'portal' : 'portals'),
      id: 'portal-list',
      width: 700
    });
  }
}

window.plugin.agenteights.portalTable = function(sortBy, sortOrder, filter) {
  // save the sortBy/sortOrder/filter
  window.plugin.agenteights.sortBy = sortBy;
  window.plugin.agenteights.sortOrder = sortOrder;
  window.plugin.agenteights.filter = filter;

  var portals = window.plugin.agenteights.listPortals;
  var sortField = window.plugin.agenteights.fields[sortBy];

  portals.sort(function(a, b) {
    var valueA = a.sortValues[sortBy];
    var valueB = b.sortValues[sortBy];

    if(sortField.sort) {
      return sortOrder * sortField.sort(valueA, valueB, a.portal, b.portal);
    }

//FIXME: sort isn't stable, so re-sorting identical values can change the order of the list.
//fall back to something constant (e.g. portal name?, portal GUID?),
//or switch to a stable sort so order of equal items doesn't change
    return sortOrder *
      (valueA < valueB ? -1 :
      valueA > valueB ?  1 :
      0);
  });

  if(filter !== 0) {
    portals = portals.filter(function(obj) {
      return filter < 0
        ? obj.portal.options.team+1 != -filter
        : obj.portal.options.team+1 == filter;
    });
  }

  var table, row, cell;
  var container = $('<div>');

  table = document.createElement('table');
  table.className = 'filter';
  container.append(table);

  row = table.insertRow(-1);

  var length = window.plugin.agenteights.listPortals.length;

  ["All", "Neutral", "Resistance", "Enlightened"].forEach(function(label, i) {
    cell = row.appendChild(document.createElement('th'));
    cell.className = 'filter' + label.substr(0, 3);
    cell.textContent = label+':';
    cell.title = 'Show only portals of this color';
    $(cell).click(function() {
      $('#agenteights').empty().append(window.plugin.agenteights.portalTable(sortBy, sortOrder, i));
    });


    cell = row.insertCell(-1);
    cell.className = 'filter' + label.substr(0, 3);
    if(i != 0) cell.title = 'Hide portals of this color';
    $(cell).click(function() {
      $('#agenteights').empty().append(window.plugin.agenteights.portalTable(sortBy, sortOrder, -i));
    });

    switch(i-1) {
      case -1:
        cell.textContent = length;
        break;
      case 0:
        cell.textContent = window.plugin.agenteights.neuP + ' (' + Math.round(window.plugin.agenteights.neuP/length*100) + '%)';
        break;
      case 1:
        cell.textContent = window.plugin.agenteights.resP + ' (' + Math.round(window.plugin.agenteights.resP/length*100) + '%)';
        break;
      case 2:
        cell.textContent = window.plugin.agenteights.enlP + ' (' + Math.round(window.plugin.agenteights.enlP/length*100) + '%)';
    }
  });

  table = document.createElement('table');
  table.className = 'portals';
  container.append(table);

  var thead = table.appendChild(document.createElement('thead'));
  row = thead.insertRow(-1);

  cell = row.appendChild(document.createElement('th'));
  cell.textContent = '#';

  window.plugin.agenteights.fields.forEach(function(field, i) {
    cell = row.appendChild(document.createElement('th'));
    cell.textContent = field.title;
    if(field.sort !== null) {
      cell.classList.add("sortable");
      if(i == window.plugin.agenteights.sortBy) {
        cell.classList.add("sorted");
      }

      $(cell).click(function() {
        var order;
        if(i == sortBy) {
          order = -sortOrder;
        } else {
          order = field.defaultOrder < 0 ? -1 : 1;
        }

        $('#agenteights').empty().append(window.plugin.agenteights.portalTable(i, order, filter));
      });
    }
  });

  portals.forEach(function(obj, i) {
    var row = obj.row
    if(row.parentNode) row.parentNode.removeChild(row);

    row.cells[0].textContent = i+1;

    table.appendChild(row);
  });

  container.append('<div class="disclaimer">Click on portals table headers to sort by that column. '
    + 'Click on <b>All, Neutral, Resistance, Enlightened</b> to only show portals owner by that faction or on the number behind the factions to show all but those portals.</div>');

  return container;
}

// portal link - single click: select portal
//               double click: zoom to and select portal
// code from getPortalLink function by xelio from iitc: AP List - https://raw.github.com/breunigs/ingress-intel-total-conversion/gh-pages/plugins/ap-list.user.js
window.plugin.agenteights.getPortalLink = function(portal) {
  var coord = portal.getLatLng();
  var perma = '/intel?ll='+coord.lat+','+coord.lng+'&z=17&pll='+coord.lat+','+coord.lng;

  // jQuery's event handlers seem to be removed when the nodes are remove from the DOM
  var link = document.createElement("a");
  link.textContent = portal.options.data.title;
  link.href = perma;
  link.addEventListener("click", function(ev) {
    renderPortalDetails(portal.options.guid);
    ev.preventDefault();
    return false;
  }, false);
  link.addEventListener("dblclick", function(ev) {
    zoomToAndShowPortal(portal.options.guid, [coord.lat, coord.lng]);
    ev.preventDefault();
    return false;
  });
  return link;
}

window.plugin.agenteights.onPaneChanged = function(pane) {
  if(pane == "plugin-agenteights")
    window.plugin.agenteights.displayPL();
  else
    $("#agenteights").remove()
};

var setup =  function() {
  if(window.useAndroidPanes()) {
    android.addPane("plugin-agenteights", "Portals list", "ic_action_paste");
    addHook("paneChanged", window.plugin.agenteights.onPaneChanged);
  } else {
    $('#toolbox').append('<a onclick="window.plugin.agenteights.displayPL()" title="Display a list of portals in the current view [t]" accesskey="t">Portals list</a>');
  }

  $("<style>")
    .prop("type", "text/css")
    .html("#agenteights.mobile {\n  background: transparent;\n  border: 0 none !important;\n  height: 100% !important;\n  width: 100% !important;\n  left: 0 !important;\n  top: 0 !important;\n  position: absolute;\n  overflow: auto;\n}\n\n#agenteights table {\n  margin-top: 5px;\n  border-collapse: collapse;\n  empty-cells: show;\n  width: 100%;\n  clear: both;\n}\n\n#agenteights table td, #agenteights table th {\n  background-color: #1b415e;\n  border-bottom: 1px solid #0b314e;\n  color: white;\n  padding: 3px;\n}\n\n#agenteights table th {\n  text-align: center;\n}\n\n#agenteights table .alignR {\n  text-align: right;\n}\n\n#agenteights table.portals td {\n  white-space: nowrap;\n}\n\n#agenteights table th.sortable {\n  cursor: pointer;\n}\n\n#agenteights table .portalTitle {\n  min-width: 120px !important;\n  max-width: 240px !important;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n#agenteights .sorted {\n  color: #FFCE00;\n}\n\n#agenteights table.filter {\n  table-layout: fixed;\n  cursor: pointer;\n  border-collapse: separate;\n  border-spacing: 1px;\n}\n\n#agenteights table.filter th {\n  text-align: left;\n  padding-left: 0.3em;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n#agenteights table.filter td {\n  text-align: right;\n  padding-right: 0.3em;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n#agenteights .filterNeu {\n  background-color: #666;\n}\n\n#agenteights table tr.res td, #agenteights .filterRes {\n  background-color: #005684;\n}\n\n#agenteights table tr.enl td, #agenteights .filterEnl {\n  background-color: #017f01;\n}\n\n#agenteights table tr.none td {\n  background-color: #000;\n}\n\n#agenteights .disclaimer {\n  margin-top: 10px;\n  font-size: 10px;\n}\n\n#agenteights.mobile table.filter tr {\n  display: block;\n  text-align: center;\n}\n#agenteights.mobile table.filter th, #agenteights.mobile table.filter td {\n  display: inline-block;\n  width: 22%;\n}\n\n")
    .appendTo("head");

}

// PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


