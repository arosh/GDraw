var Mode = {
    DRAW   : 0,
    EDIT   : 1,
    DELETE : 2
};

var gridWidth = 20;

var svg;
var d3svg;
var graph;
var mouseX = 0, mouseY = 0;
var dragging = false;
var mousePath = []
var editMode = Mode.DRAW;
var gridMode = false;
var nodeToFront = true;
var selectedNodeId = [];

var main = function() {
    svg = $("#main-svg");
    d3svg = d3.select("body").select("svg");
    graph = new Graph(onGraphChanged);

    // draw grid
    for (var i = 0; i * gridWidth < 800; i++) {
        for (var j = 0; j * gridWidth < 600; j++) {
            if ((i + j) % 2 === 1) {
                d3svg.append("rect")
                    .attr("x", i * gridWidth)
                    .attr("y", j * gridWidth)
                    .attr("width", gridWidth)
                    .attr("height", gridWidth)
                    .attr("fill", "#e0e0e0");
            }
        }
    }

    // event handlers
    svg.mousedown(onSVGMouseDown);
    svg.mousemove(onSVGMouseMove);
    svg.mouseup(onSVGMouseUp);
    svg.bind("contextmenu", function(e) { e.preventDefault();});
    svg.bind("touchstart", onSVGMouseDown);
    svg.bind("touchmove", onSVGMouseMove); 
    svg.bind("touchend", onSVGMouseUp); 

    $("#btn-draw").click(function(){setEditMode(Mode.DRAW)});
    $("#btn-edit").click(function(){setEditMode(Mode.EDIT)});
    $("#btn-delete").click(function(){setEditMode(Mode.DELETE)});
    $("#btn-undo").click(onUndo);
    $("#btn-redo").click(onRedo);
    $("#btn-export-edge").click(onExportEdge);
    $("#btn-export-svg").click(onExportSVG);
    $("#node-color").change(onChangeNodeColor);
    $("#node-stroke-color").change(onChangeNodeStrokeColor);    

    // shortcuts
    shortcut.add("Ctrl+Z", onUndo, {"disable_in_input": true});
    shortcut.add("Ctrl+Y", onRedo, {"disable_in_input": true});
    shortcut.add("G", toggleGridMode, {"disable_in_input": true});
    
    Module.loadModel();

    setEditMode(Mode.DRAW);
}

var onSVGMouseDown = function(e) {
    e.preventDefault();
    dragging = true;
    switch (editMode) {
    case Mode.DRAW:
        mousePath = [[mouseX, mouseY]];
        break;
    case Mode.DELETE:
        var id = getNodeIdFromPosition(mouseX, mouseY);
        if (id !== -1) {
            graph.deleteNode(id);
            graph.commit();
        } else {
            id = getEdgeIdFromPosition(mouseX, mouseY);
            if (id !== -1) {
                graph.deleteEdge(id);
                graph.commit();
            }
        }
        break;
    default:
        break;
    }
    
    var id = getNodeIdFromPosition(mouseX, mouseY);
    if(id !== -1){
        selectedNodeId = [id];
        $('#node-id').val(id);
        $('#node-color').val(graph.getNodeColor(id));
        $('#node-stroke-color').val(graph.getNodeStrokeColor(id));
    }
};

var onSVGMouseMove = function(e) {
    var boundingBox = svg[0].getBoundingClientRect();
    mouseX = e.clientX - boundingBox.left;
    mouseY = e.clientY - boundingBox.top;
    if (dragging && editMode === Mode.DRAW) {
        mousePath.push([mouseX, mouseY]);
        drawLocus();
    }
}

var onSVGMouseUp = function(e) {
    d3svg.selectAll("path").filter(".locus").remove();

    if (mousePath.length > 3 && editMode === Mode.DRAW) {
        var x = new Module.VInt();
        var y = new Module.VInt();
        for (var i = 0; i < mousePath.length; i++) {
            x.push_back(mousePath[i][0]);
            y.push_back(mousePath[i][1]);
        }

        var shape = Module.classify(x, y);
        addShape(shape);
        console.log(shape);
    }

    mousePath = [];
    dragging = false;
}

var setEditMode = function(mode) {
    editMode = mode;
    $(".edit-mode").removeClass("active");

    var activeElement;
    switch (mode) {
    case Mode.DRAW:
        activeElement = $("#btn-draw");
        break;
    case Mode.EDIT:
        activeElement = $("#btn-edit");
        break;
    case Mode.DELETE:
        activeElement = $("#btn-delete");
        break;
    default:
        break;
    }
    activeElement.addClass("active");
}

var onUndo = function() {
    graph.undo();
}

var onRedo = function() {
    graph.redo();
}

var onExportEdge = function() {
    $("#textarea").val(getEdgeListString());
}

var onExportSVG = function() {
    $("#textarea").val(getSVGString());
}

var onChangeNodeColor = function() {
    for(var i = 0; i < selectedNodeId.length; ++i) {
        graph.setNodeColor(selectedNodeId[i], $("#node-color").val());
    }
    
    if(selectedNodeId.length > 0) {
        graph.commit();
    }
}

var onChangeNodeStrokeColor = function() {
    for(var i = 0; i < selectedNodeId.length; ++i) {
        graph.setNodeStrokeColor(selectedNodeId[i], $("#node-stroke-color").val());
    }
    
    if(selectedNodeId.length > 0) {
        graph.commit();
    }
}


var toggleGridMode = function(){
    gridMode = !gridMode;
}

var addShape = function(shape) {
    var sid = getNodeIdFromPosition(shape.x1, shape.y1);
    var tid = getNodeIdFromPosition(shape.x2, shape.y2);
    console.log([sid, tid]);
    
    switch (shape.shape) {
    case Module.Shape.CIRCLE:
        graph.addNode(Math.round(shape.x1), Math.round(shape.y1));
        break;
    case Module.Shape.LINE:
        if (sid === -1) break;
        if (tid === -1) {
            tid = graph.addNode(shape.x2, shape.y2);
        }
        graph.addEdge(sid, tid);
        break;
    case Module.Shape.ARROW:
        if (sid === -1) break;
        if (tid === -1) {
            tid = graph.addNode(shape.x2, shape.y2);
        }
        graph.addEdge(sid, tid);
        break;
    }
    graph.commit();
}

var getNodeIdFromPosition = function(x, y) {
    var ans = -1;
    for (var i in graph.nodes) {
        var v = graph.nodes[i];
        var d = (x - v.x) * (x - v.x) + (y - v.y) * (y - v.y);
        if (d < Math.pow(v.radius + v.width / 2.0 + 3.0, 2)) ans = v.id;
    }

    return ans;
}

var getEdgeIdFromPosition = function(x, y) {
    var ans = -1;
    for (var i in graph.edges) {
        var e = graph.edges[i];
        var sv = graph.nodes[e.source];
        var tv = graph.nodes[e.target];
        var dx = tv.x - sv.x;
        var dy = tv.y - sv.y;
        var length = Math.max(1.0, Math.sqrt(dx * dx + dy * dy));
        var x1 = sv.x + dx / length * (sv.radius + sv.width / 2);
        var y1 = sv.y + dy / length * (sv.radius + sv.width / 2);
        var x2 = tv.x - dx / length * (sv.radius + sv.width / 2);
        var y2 = tv.y - dy / length * (sv.radius + sv.width / 2);
        console.log([[x1, y1], [x2, y2], [x, y]]);
        var d = distanceSP([x1, y1], [x2, y2], [x, y]);
        if (d < e.width / 2 + 5.0) ans = e.id;
        console.log(d);
    }
    console.log(ans);
    return ans;
}

var drawLocus = function() {
    if (editMode !== Mode.DRAW) return;
    var locus = d3svg.selectAll("path").filter(".locus").data([mousePath]);
    locus.enter().append("path");
    locus.exit().remove();
    locus.attr("class", "locus")
        .attr("d", function(d) {
            var command = "";
            for (var i = 0; i < d.length; i++) {
                command += i ? "L " : "M ";
                command += d[i][0] + " ";
                command += d[i][1] + " ";
            }
            return command;
        })
        .attr("stroke-width", 3)
        .attr("stroke", "red")
        .attr("stroke-opacity", 0.7)
        .attr("fill", "none");
}

var onGraphChanged = function() {
    drawGraph();
    
    if (graph.canUndo()) {
        $("#btn-undo").removeClass("invalid");
    } else {
        $("#btn-undo").addClass("invalid");
    }
    if (graph.canRedo()) {
        $("#btn-redo").removeClass("invalid");
    } else {
        $("#btn-redo").addClass("invalid");
    }
}

var drawGraph = function() {
    var g = graph;
    
    // edges
    var edgeData = d3.entries(g.edges);
    for (var i = 0; i < edgeData.length; i++) {
        edgeData[i].kind = "edge";
    }

    var lines = d3svg.selectAll(".edges")
        .data(edgeData);
    
    lines.enter().append("line");
    lines.exit().remove();
    
    var getXY = function(sourceid, targetid){
        var sv = g.nodes[sourceid];
        var tv = g.nodes[targetid];
        var dx = tv.x - sv.x;
        var dy = tv.y - sv.y;
        var scale = (sv.radius + sv.width / 2) / Math.max(1.0, Math.sqrt(dx * dx + dy * dy));
        return {v : sv, x : dx * scale, y : dy * scale};
    }

    lines.attr({
        "class" : "edges",
        "x1" : function(d) {
            var  t =  getXY(d.value.source, d.value.target);
            return t.v.x + t.x;
        },
        "y1" : function(d) {
            var  t =  getXY(d.value.source, d.value.target);
            return t.v.y + t.y;
        },
        "x2" : function(d) {
            var  t =  getXY(d.value.target, d.value.source);
            return t.v.x + t.x;
        },
        "y2" : function(d) {
            var  t =  getXY(d.value.target, d.value.source);
            return t.v.y + t.y;
        },
        "stroke-width" : function(d) {return d.value.width;},
        "stroke" : "black",
    });
    
    //lines.order();

    // nodes
    var nodeData = d3.entries(g.nodes);
    for (var i = 0; i < nodeData.length; i++) {
        nodeData[i].kind = "node";
    }

    var circles = d3svg.selectAll(".nodes")
        .data(nodeData);
    
    circles.enter().append("circle");
    circles.exit().remove();
    
    circles.attr("class", "nodes")
        .attr("cx", function(d) {return d.value.x;})
        .attr("cy", function(d) {return d.value.y;})
        .attr("r", function(d) {return d.value.radius;})
        .attr("stroke-width", function(d) {return d.value.width;})
        .attr("stroke", function(d){return d.value.strokeColor;})
        .attr("stroke-opacity", 1)
        .attr("fill", function(d){return d.value.color;})
        .attr("fill-opacity", 1)
        .call(d3.behavior.drag().on("drag", function(d) {
            if (editMode === Mode.EDIT) {
                d.value.vx += d3.event.dx;
                d.value.vy += d3.event.dy;
                if (gridMode) {
                    d.value.x = Math.round(d.value.vx / gridWidth) * gridWidth;
                    d.value.y = Math.round(d.value.vy / gridWidth) * gridWidth;
                } else {
                    d.value.x = d.value.vx;
                    d.value.y = d.value.vy;
                }
                drawGraph();
            }}).on("dragend", function(d) {
                if (editMode === Mode.EDIT) {
                    d.value.vx = d.value.x;
                    d.value.vy = d.value.y;
                    graph.setNodePosition(d.value.id, d.value.x, d.value.y);
                    graph.commit();
                }
            }));

    if (nodeToFront) {
        d3svg.selectAll(".nodes, .edges")
            .sort(function(a, b) {
                if (a.kind !== b.kind) return a.kind === "node" ? 1 : -1;
                return a.key > b.key ? 1 : -1;
            });
    }
}

var getSVGString = function() {
    var output = "";
    var elements = d3svg.selectAll(".nodes, .edges")[0];
    output += "<?xml version=\"1.0\"?>\n";
    output += "<svg xmlns=\"http://www.w3.org/2000/svg\">\n";
    for (var i = 0; i < elements.length; i++) {
        output += "  " + elements[i].outerHTML + "\n";
    }
    output += "</svg>\n";
    return output;
}

var getEdgeListString = function() {
    var edges = graph.edges;
    var directed = false;
    var normalizedId = new Object();
    var itr = 1;

    for (var i in edges) {
        var e = edges[i];
        directed |= e.directed;
        if (normalizedId[e.source] === undefined) {
            normalizedId[e.source] = itr;
            itr++;
        }
        if (normalizedId[e.target] === undefined) {
            normalizedId[e.target] = itr;
            itr++;
        }
    }
    
    var output = "";
    output += "#" + (directed ? "Directed" : "Undirected") + " graph\n"
    output += "#Nodes: " + Object.keys(graph.nodes).length.toString() + "\n";
    output += "#Edges: " + Object.keys(graph.edges).length.toString() + "\n";
    for (var i in edges) {
        var e = edges[i];
        var u = normalizedId[e.source], v = normalizedId[e.target];
        if (!directed) {
            if (v < u) v = [u, u = v][0];
            output += u.toString() + " " + v.toString() + "\n";
        } else {
            output += u.toString() + " " + v.toString() + "\n";
            if (!e.directed) {
                output += v.toString() + " " + u.toString() + "\n";
            }
        }
    }
    return output;
}

window.onload = main;

//main();
