var protocol = (
  ("https:" == document.location.protocol)
  ? "https"
  : "http"
);
d3.jsonp(protocol + '://chartercomplex-server.herokuapp.com/nodes.json?callback={callback}', function(got_some_nodes) {
  d3.jsonp(protocol + '://chartercomplex-server.herokuapp.com/edges.json?callback={callback}', function(got_some_edges) {
    window.data = {
      nodes: got_some_nodes.nodes,
      links: got_some_edges.edges,
      mLinkNum: {},
    };

    var nodeIds = _.pluck(data.nodes,'id');
    window.data.links.forEach(function(l){
      l.source = nodeIds.indexOf(l.source);
      l.target = nodeIds.indexOf(l.target);
    });

    tree(window.data);

    doEverything(window.data);

  });
});

function normalize_cat_name(name) {
  return name.trim().toLowerCase();
}

/**
 * Gets neighbors of a node, based on its edges.
 *
 * @todo degrees
 */
function get_neighbors(id, degree, edges) {
  return _.uniq(
    _.reduce(edges, function(memo, edge) {
      var source;
      var target;
      source = (edge.source.id) ? edge.source.id : edge.source;
      target = (edge.target.id) ? edge.target.id : edge.target;
      if (source == id) {
        memo.push(target);
      }
      if (target == id) {
        memo.push(source);
      }
      return memo;
    }, [])
  );
}

function addNeighborsToNodes(nodes, edges, degree) {
  var newnodes = _.map(nodes, function(node) {
    node.neighbors = get_neighbors(node.id, degree, edges);
    return node;
  });
  return newnodes;
}

function tree(data) {
  // build jstree data:
  var cat_names = _.uniq(_.map(_.pluck(data.nodes, 't'), function(name) {
    return normalize_cat_name(name);
  }));
  var categories = [];
  _.each(cat_names, function(category) {
    categories.push({
      "id" : normalize_cat_name(category),
      "parent" : "#",
      "text" : category
    });
  });

/**
 * Toggle a single node by its D3 index.
 *
 * @param id
 *   d3.js id
 */
function selectNode(id) {
  d3.selectAll('.node')
    .filter(function(d, i) {
      return d.id==id
    })
    .each(toggle_node);
}

  _.each(data.nodes, function(node) {
    categories.push({
      'id': node.id,
      'parent': normalize_cat_name(node.t),
      'text': node.name
    });
  });

$('#treeview').jstree({
    'core': {
      'data' : categories
    }
  });

  $('#treeview').on('select_node.jstree', function (e, jstree_node) {
    d3.selectAll(".node").style("fill", function(d) {
      if (d.name==jstree_node.node.text) {
        var context = this;
        return toggle_node(d, null, context);
      } else {
        return d.fillColor;
      }
    });
  });

  // $('#jstree_demo_div').on("changed.jstree", function (e, data) {
  //    console.log(data.selected);
  // });
} 

/* // method to create filter
function createFilter() {
  d3.select(".filterContainer").selectAll("div")
    .data(["1992", "1998", "2006", "2007", "2008", "2009", "2010", "2011", "2012", "2013", "2014"])
    .enter()
    .append("div")
        .attr("class", "checkbox-container")
    .append("label")
    .each(function(d) {
// create checkbox for each data
  d3.select(this).append("input")
    .attr("type", "checkbox")
    .attr("id", function(d) {return "chk_" + d;})
    .attr("checked", true)
    .on("click", function(d, i) {
        // register on click event
        var lVisibility = this.checked? "visible":"hidden";
          filterGraph(d, lVisibility);
        })
    d3.select(this).append("span")
      .text(function(d){return d;});
      });

    $("#sidebar").show();  // show sidebar
}
*/
function doEverything(data) {

  var width = window.innerWidth,
      height = window.innerHeight;

  var force = cola.d3adaptor()
      .nodes(d3.values(data.nodes))
      .links(data.links)
      .size([width, height])
      .symmetricDiffLinkLengths(17)
      //.avoidOverlaps(true)
      .on("tick", tick)
      .start(12,17,22);
    data.nodes = addNeighborsToNodes(data.nodes, data.links, 1);

  var svg = d3.select("#graph").append("svg")
      .attr("width", width)
      .attr("height", height);

  var link = svg.selectAll(".link")
      .data(force.links())
      .enter().append("svg:path")
      .attr("class", "link")
      .style("stroke", function (d) {
        var colorLink;
          if (d.tags=="Grant") {
            colorLink="green";
          }
          else {
            colorLink="black";
          }
          d.stroke = colorLink;
          return colorLink;
      })

      .call(d3.helper.tooltip()
        .attr({class: function(d, i) {
          return d + ' ' +  i + ' A';}})
        .style({color: 'black'})
        .text(function(d,i){return 'citation: '+ d.citation;})
        )
        .on('mouseover', function(d, i){ d3.select(this).style({fill: 'red'}); })
        .on('mouseout', function(d, i){ d3.select(this).style({fill: 'blue'}); });

  sortLinks();
  setLinkIndexAndNum();

  var labels = svg.selectAll('text')
      .data(data.links)
      .enter().append('text')
      .attr("x", function(d) { return (d.source.y + d.target.y) / 2; })
      .attr("y", function(d) { return (d.source.x + d.target.x) / 2; })
      .attr("text-anchor", "middle")
      .text(function(d) {return d.label;});

  var node = svg.selectAll(".node")
      .append('g').data(force.nodes());

  var sampleSVG = d3.select('.viz')
      .append('svg')
      .attr({width: 600, height: 100});

  node.enter().append("g")
      .append("path")
      .attr("class", "node")
      .attr("d",  d3.svg.symbol().size(120)
        .type(function(d) {
          var typeStr;
          if(d.t=="Organization") {
            typeStr="square";
          }
          else if(d.t=="Company") {
            typeStr="square";
          }
          else if(d.t=="Foundation") {
            typeStr= "cross";
          }
          else if(d.t=="Municipality") {
            typeStr= "cross";
          }
          else if(d.t=="Person") {
            typeStr= "circle";
          }
          else if(d.t=="Board") {
            typeStr="circle";
          }
          else if(d.t=="District") {
            typeStr="triangle-down";
          }
          else if(d.t=="School") {
            typeStr="triangle-up";
          }
          else if(d.t=="Building") {
            typeStr="triangle-up";
          }
          else if(d.t=="University") {
            typeStr="diamond";
          }
          else if(d.t=="EMO") {
            typeStr="diamond";
          }
          return typeStr;
        })
      )
      .style("fill", function (d) {
        var colorStr;
          if(d.t=="Organization") {
            colorStr='blue';
          }
          else if(d.t=="Company") {
            colorStr='red';
          }
          else if(d.t=="Foundation") {
            colorStr='purple';
          }
          else if(d.t=="Municipality") {
            colorStr='pink';
          }
          else if(d.t=="Person") {
            colorStr='brown';
          }
          else if(d.t=="Board") {
            colorStr='green';
          }
          else if(d.t=="District") {
            colorStr='orange';
          }
          else if(d.t=="School") {
            colorStr='orange';
          }
          else if(d.t=="Building") {
            colorStr='green';
          }
          else if(d.t=="University") {
            colorStr='yellow';
          }
          else if(d.t=="EMO") {
            colorStr='red';
          }
        d.fillColor = colorStr;
        d.toggled = false;
        return colorStr;
        })
      .attr("data-legend",function(d) { return d.t})
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .on("click", toggle_node)
      .call(force.drag);

  node.append("text")
      .style("fill", "black")
      .attr("x", 12)
      .attr("dy", ".35em")
      .text(function(d) { return d.name; });

  function tick() {
    link
      .attr("d", function(d) {
        var dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            dr = Math.sqrt(dx * dx + dy * dy);
        var lTotalLinkNum = data.mLinkNum[d.source.index + "," + d.target.index] || data.mLinkNum[d.target.index + "," + d.source.index];
        if (lTotalLinkNum > 1) {
          dr = dr/(1 + (1/lTotalLinkNum) * (d.linkindex - 1));
        }
        return "M" + d.source.x + "," + d.source.y +
          "A" + dr + "," + dr + " 0 0 1," + d.target.x + "," + d.target.y +
          "A" + dr + "," + dr + " 0 0 0," + d.source.x + "," + d.source.y;
      });

    node
        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

    labels
        .attr("x", function(d) { return (d.source.x + d.target.x) / 2; })
        .attr("y", function(d) { return (d.source.y + d.target.y) / 2; });
  }

  function mouseover() {
    d3.select(this).transition()
        .duration(750)
        .attr('transform', 'scale(2)');
  }

  function mouseout() {
    d3.select(this).transition()
        .duration(750)
        .attr('transform', 'scale(1)');
  }

  function sortLinks() {
    data.links.sort(function(a,b) {
      if (a.source.index > b.source.index) {
        return 1;
      }
      else if (a.source.index < b.source.index) {
        return -1;
      }
      else {
        if (a.target.index > b.target.index) {
          return 1;
        }
        if (a.target.index < b.target.index) {
          return -1;
        }
        else {
          return 0;
        }
      }
    });
  }

  function setLinkIndexAndNum() {
    for (var i = 0; i < data.links.length; i++) {
      if (i != 0 &&
        data.links[i].source.index == data.links[i-1].source.index &&
        data.links[i].target.index == data.links[i-1].target.index) {
        data.links[i].linkindex = data.links[i-1].linkindex + 1;
      }
      else {
        data.links[i].linkindex = 1;
      }
      if (data.mLinkNum[data.links[i].target.index + "," + data.links[i].source.index] !== undefined) {
        data.mLinkNum[data.links[i].target.index + "," + data.links[i].source.index] = data.links[i].linkindex;
      }
      else {
        data.mLinkNum[data.links[i].source.index + "," + data.links[i].target.index] = data.links[i].linkindex;
      }
    }
  }

legend = svg.append("g")
  .attr("class","legend")
  .attr("transform","translate(50,30)")
  .style("font-size","9px")
  .call(d3.legend)

}

/**
 * Sets a certain node (data node and the corresponding d3 dom element)
 * as clicked or unclicked.
 *
 * Needs context `this` as current DOM element
 *
 * @param d
 *   d3 data object
 *
 * @param index
 *   d3 index, per its API (unused)
 *
 * @param context
 *   if u don't want the function to use `this`
 *
 * @param on_or_off
 *   if provided, set node as not-greyed-out (on) or greyed-out (off)a
 *   if not provided, function will just toggle the node
 *
 * @return
 *   new color
 **/

//grey out node function
//select neighbor nodes
//highlight node

function greyOutNode(node, on_or_off)
{
    if(on_or_off){
      node.grayed_out=true;
    }
    else{
      node.grayed_out=false;
    }
}

function greyOutAll(on_or_off)
{
  d3.selectAll('.node').classed('active', function(d){
    greyOutElement(d,on_or_off);
    return false;
  })

   d3.selectAll('text').classed('active', function(d) {
    return false;
   })

   d3.selectAll('.link').classed('active', function(d) {
    return false;
    })
}


function toggle_node(d, index, context, on_or_off) {
  var thiiiiiis = (context ? context : this);
  d.toggled = !d.toggled;
  var toggleColor = (d.toggled ? d.fillColor : "yellow");
  d3.select(thiiiiiis).style("fill", toggleColor);

  highlight_neighbor_nodes(d.id, d.name, d.neighbors);
  /*
  highlight_neighbor_edges(d.source.id, d.label, d.source.neighbors);
  */

  return toggleColor;
}



function highlight_neighbor_nodes(center_node_id, center_node_label, neighbors) {
  d3.selectAll('.node').classed('active', function(d) {
    if (d.id !== center_node_id && !_.contains(neighbors, d.id)) {
      d.grayed_out == true;
      return false;
    }
    return true;
  });

  d3.selectAll('text').classed('active', function(d) {
    if (d.hasOwnProperty('source') || d.hasOwnProperty('target')) {
      if (d.source.id == center_node_id || d.target.id == center_node_id) {
        return true;
      } else {
        return false;
      }
    } else {
    if (d.id !== center_node_id && !_.contains(neighbors, d.id)) {
      d.grayed_out == true;
      return false;
    }
    return true;
    }
  });

  d3.selectAll('.link').classed('active', function(d) {
    if (d.hasOwnProperty('source') || d.hasOwnProperty('target')) {
      if (d.source.id == center_node_id || d.target.id == center_node_id) {
        return true;
      } else {
        return false;
      }
    }
  });
}

