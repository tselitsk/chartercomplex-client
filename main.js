var protocol = (
  ("https:" === document.location.protocol)
  ? "https"
  : "http"
);

d3.jsonp(protocol + '://chartercomplex-server.herokuapp.com/nodes.json?callback={callback}', function (got_some_nodes) {
  d3.jsonp(protocol + '://chartercomplex-server.herokuapp.com/edges.json?callback={callback}', function (got_some_edges) {
    window.data = {
      nodes: got_some_nodes.nodes,
      links: got_some_edges.edges,
      mLinkNum: {},
    };

    var nodeIds = _.pluck(data.nodes, 'id');
    window.data.links.forEach(function (l) {
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
    _.reduce(edges, function (memo, edge) {
      var source;
      var target;
      source = (edge.source.id) ? edge.source.id : edge.source;
      target = (edge.target.id) ? edge.target.id : edge.target;
      if (source === id) {
        memo.push(target);
      }
      if (target === id) {
        memo.push(source);
      }
      return memo;
    }, [])
  );
}

function addNeighborsToNodes(nodes, edges, degree) {
  var newnodes = _.map(nodes, function (node) {
    node.neighbors = get_neighbors(node.id, degree, edges);
    return node;
  });
  return newnodes;
}

function tree(data) {
  // build jstree data:
  var cat_names = _.uniq(_.map(_.pluck(data.nodes, 't'), function (name) {
    return normalize_cat_name(name);
  }));
  var categories = [];
  _.each(cat_names, function (category) {
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
    .filter(function (d, i) {
      return d.id == id
    })
    .each(toggle_node);
}

  _.each(data.nodes, function (node) {
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
    d3.selectAll(".node").each(function (d) {
      if (d.name == jstree_node.node.text) {
        var context = this;
        toggle_node(d, null, context);
      }
    });
  });
}

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
      .start(12, 17, 22);

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
          if (d.tags == "Grant") {
            colorLink = "green";
          }
          else {
            colorLink = "black";
          }
          d.stroke = colorLink;
          return colorLink;
      })

      .call(d3.helper.tooltip()
        .attr({class: function (d, i) {
          return d + ' ' +  i + ' A';
        }})
        .style({color: 'black'})
        .text(function (d, i) {
          return 'citation: ' + d.citation;
        })
      )

        .on('mouseover', function (d, i) {
          d3.select(this).style({fill: 'red'});
        })
        .on('mouseout', function (d, i) {
          d3.select(this).style({fill: 'blue'});
        });

  sortLinks();
  setLinkIndexAndNum();

  var labels = svg.selectAll('text')
      .data(data.links)
      .enter().append('text')
      .attr("x", function (d) {
        return (d.source.y + d.target.y) / 2;
      })
      .attr("y", function (d) {
        return (d.source.x + d.target.x) / 2;
      })
      .attr("text-anchor", "middle")
      .text(function (d) {
        return d.label;
      });

  var node = svg.selectAll(".node")
      .append('g').data(force.nodes());

  node.enter().append("g")
      .append("path")
      .attr("class", "node")
      .attr("d",  d3.svg.symbol().size(120)
        .type(function (d) {
          var typeStr;
          switch (d.t) {
            case "Organization":
            case "Company":
            case "Foundation":
            case "Municipality":
              typeStr = "square";
              break;
            case "Person":
            case "Board":
              typeStr = "circle";
              break;
            case "District":
              typeStr = "triangle-down";
              break;
            case "School":
            case "Building":
              typeStr = "triangle-up";
              break;
            case "University":
            case "EMO":
            default:
              typeStr = "diamond";
              break;
          }
          return typeStr;
        })
      )
      .style("fill", function (d) {
        var colorStr;
        switch (d.t) {
          case "Organization":
            colorStr = 'blue';
          case "Company":
            colorStr = 'red';
          case "Foundation":
            colorStr = 'purple';
            break;
          case "Municipality":
            colorStr = 'pink';
            break;
          case "Person":
            colorStr = 'brown';
            break;
          case "Board":
            colorStr = 'green';
            break;
          case "District":
          case "School":
            colorStr = 'orange';
            break;
          case "Building":
            colorStr = 'green';
            break;
          case "University":
            colorStr = 'yellow';
            break;
          case "EMO":
          default:
            colorStr = 'red';
            break;
        }
        d.fillColor = colorStr;
        d.toggled = false;
        return colorStr;
      })
      .attr("data-legend",function (d) {
        return d.t;
      })
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .on("click", toggle_node)
      .call(force.drag);

  node.append("text")
      .style("fill", "black")
      .attr("x", 12)
      .attr("dy", ".35em")
      .text(function (d) {
        return d.name;
      });

  function tick() {
    link
      .attr("d", function (d) {
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
      .attr("transform", function (d) {
        return "translate(" + d.x + "," + d.y + ")";
      });

    labels
      .attr("x", function (d) {
        return (d.source.x + d.target.x) / 2;
      })
      .attr("y", function (d) {
        return (d.source.y + d.target.y) / 2;
      });
  }

  function mouseover() {
    d3.select(this)
       .transition()
       .duration(750)
       .attr('transform', 'scale(2)');
  }

  function mouseout() {
    d3.select(this)
       .transition()
       .duration(750)
       .attr('transform', 'scale(1)');
  }

  function sortLinks() {
    data.links.sort(function (a, b) {
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
    .call(d3.legend);

  // Build filter widget
  build_year_filter_widget('#filters', get_all_start_years(data.links));
}


//grey out node function
//select neighbor nodes
//highlight node

function greyOutNode(node, on_or_off) {
  if (on_or_off) {
    node.grayed_out=true;
  }
  else {
    node.grayed_out=false;
  }
}

function greyOutAll(on_or_off) {
  d3.selectAll('.node').classed('active', function(d) {
    greyOutNode(d, on_or_off);
    return false;
  });

  d3.selectAll('text').classed('active', function(d) {
    return false;
  });

  d3.selectAll('.link').classed('active', function(d) {
    return false;
  });
}

/**
 * Sets a certain node (data node and the corresponding d3 dom element)
 * as clicked or unclicked.
 *
 * Needs context `this` as current DOM element
 *
 * @param node_to_toggle
 *   d3 data object
 *
 * @param index
 *   d3 index, per its API (unused)
 *
 * @param context
 *   if u don't want the function to use `this`
 *
 * @return
 *   true is it works
 */
function toggle_node(node_to_toggle, index, context) {
  var thiiiiiis = (context ? context : this);
  node_to_toggle.toggled = true;
  d3.select(thiiiiiis).style('fill', 'yellow');
  d3.selectAll('.node')
    .filter(function(d_node) { return d_node != node_to_toggle; })
    .style('fill', function(d_node) { return d_node.fillColor; });

  highlight_neighbor_nodes(node_to_toggle.id, node_to_toggle.name, node_to_toggle.neighbors);

  return true;
}

function highlight_neighbor_nodes(center_node_id, center_node_label, neighbors) {
  d3.selectAll('.node').classed('active', function (d) {
    if (d.id !== center_node_id && !_.contains(neighbors, d.id)) {
      d.grayed_out == true;
      return false;
    }
    return true;
  });

  d3.selectAll('text').classed('active', function (d) {
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

  d3.selectAll('.link').classed('active', function (d) {
    if (d.hasOwnProperty('source') || d.hasOwnProperty('target')) {
      if (d.source.id == center_node_id || d.target.id == center_node_id) {
        return true;
      } else {
        return false;
      }
    }
  });
}

/**
 * Given data.links, return chronologically sorted array of years.
 *
 * @param links
 *   data.links
 *
 * @return
 *   array of year integers
 */
function get_all_start_years(links) {
  return _.uniq(
    _.reduce(links, function(memo, link) {
      if (link.startyear !== null) {
        memo.push(link.startyear);
      }
      return memo;
    }, [])
  ).sort();
}

/**
 * Build year filter widget.
 *
 * Via http://jsfiddle.net/zhanghuancs/cuYu8/
 *
 * @param container_selector
 *   string to use as d3 selector for element in which to build widget
 *
 * @param year_opts
 *   array of years to offer as options
 */
function build_year_filter_widget(container_selector, year_opts) {
  d3.select(container_selector)
    .selectAll('div')
    .data(year_opts)
    .enter()
    .append('label')
    .each(function(d) {
      d3.select(this)
        .append('input')
        .attr('type', 'checkbox')
        .attr('checked', true)
        .on('click', function(d) {
          filter_graph_by_year(d, (this.checked ? 'visible' : 'hidden'));
        })
      d3.select(this)
        .append('span')
        .text(function(d) {
          return d;
        });
    });
}

/**
 * Find links in the network graph with startdate year,
 * and hide (or show) them along with their labels and
 * potentially orphaned nodes.
 *
 * @param year
 *   integer selected year
 *
 * @param visibility
 *   string css visibility value
 */
function filter_graph_by_year(year, visibility) {
  d3.selectAll('.link')
    .style('visibility', function(d, i) {
      d.visibility = (d.startyear == year ? visibility : $(this).css('visibility'));
      // hide corresponding text label
      if (d.visibility == 'hidden') {
        d3.selectAll('text').filter(function(d_text) {
          return d_text == d;
        }).style('visibility', 'hidden');
      } else {
        d3.selectAll('text').filter(function(d_text) {
          return d_text == d;
        }).style('visibility', 'visible');
      }
      return d.visibility;
    });

  d3.selectAll('.node')
    .style('visibility', function(d_node, i_node) {
      var hide_this = true;
      // If any of this node's links are visible, this node shouldn't be hidden.
      d3.selectAll('.link')
        .each(function(d_link, i_link) {
          if (d_link.source === d_node || d_link.target === d_node) {
            if (this.style.visibility == 'visible') {
              hide_this = false;
              d3.selectAll('text')
                .filter(function (d_text) { return d_text == d_link; })
                .style('visibility', 'visible');
              return 'visible';
            }
          }
        });
      if (hide_this) {
        d3.selectAll('text')
          .filter(function (d_text) { return d_text == d_node; })
          .style('visibility', 'hidden');
        return 'hidden';
      } else {
        d3.selectAll('text')
          .filter(function (d_text) { return d_text == d_node; })
          .style('visibility', 'visible');
        return 'visible';
      }
    });
}

