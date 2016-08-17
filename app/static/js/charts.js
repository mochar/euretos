function graphChart() {
    // config variables
    var publicationCount = 1,
        publicationMax = 100,
        oneColor = false,
        sameWidth = false,
        lonelyConcepts = false;
        
    // 
    var width = 100,
        height = 100,
        nodeHeight = 20,
        linkWidth = d3.scaleLog().domain([1, publicationMax]).range([2, 6]);
        
    var link, node;
        
    // data variables
    var concepts = [],
        conceptsById = d3.map(),
        predicates = [],
        allPredicates = [],
        allPredicatesById = d3.map(),
        bilinks = [];
        
    // d3-force forces
    var linkForce = d3.forceLink().id(function(d) { return d.id; }).distance(100),
        chargeForce = d3.forceManyBody().strength(-40),
        centerForce = d3.forceCenter(width / 2, height / 2);
    
    // d3-force simulation object
    // Link nodes are identified by d.id, so we don't have to add the nodes 
    // manually to the link objects.
    // var simulation = d3.forceSimulation()
    //     .force('link', d3.forceLink().id(function(d) { return d.id; }).distance(100))
    //     .force('charge', d3.forceManyBody().strength(-40))
    //     .force('center', d3.forceCenter())
    //     .on('tick', ticked);
    var simulation = d3.forceSimulation().on('tick', ticked);
        
    function chart(selection) {
        selection.each(function(data) {
            console.log('update');
            // Select the svg element, if it exists.
            var svg = d3.select(this).selectAll('svg').data([data]);

            // Otherwise, create the skeletal chart.
            var svgEnter = svg.enter().append('svg');
            var gEnter = svgEnter.append('g');
            gEnter.append('g').attr('class', 'links');
            gEnter.append('g').attr('class', 'nodes');
            svgEnter.append('defs');
            
            svgEnter.call(d3.zoom()
                .scaleExtent([1 / 2, 8])
                .translateExtent([[0-width, 0-height], [width+width, height+height]])
                .on('zoom', function() { gEnter.attr('transform', d3.event.transform); }));
                
            // Select data holders
            svg = d3.select(this).select('svg');
            var defs = svg.select('defs'),
                g = svg.select('g');
            
            // Update the outer dimensions.
            svg.attr('width', width).attr('height', height);
            
            // Update simulation
            // simulation.force('center').x(width / 2).y(height / 2);
            simulation
                .force('link', linkForce)
                .force('charge', chargeForce)
                .force('center', centerForce.x(width / 2).y(height / 2));
            
            // Create arrow-head markers per predicate-type
            var marker = defs.selectAll('marker')
                .data(allPredicates.concat(['marker-default']), function(d) { return d.id ? d.id : d; });
            marker.exit().remove();
            var markerEnter = marker.enter().append('marker')
                .attr('id', function(d) { return d.id ? 'marker-' + d.id : d; })
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 6)
                .attr('markerWidth', 6)
                .attr('markerHeight', 6)
                .attr('orient', 'auto')
              .append('path')
                .attr('d', 'M0,-5L10,0L0,5');
            markerEnter.merge(marker)
                .attr('fill', function(d) { return d.id ? d.color : 'darkgrey'; })
                .attr('color', function(d) { return d.id ? d.color : 'darkgrey'; });
                
            // Links are the predicates that connect the concepts (nodes)
            link = g.select('g.links')
                .selectAll('.link')
                .data(bilinks, function(d) { return d[3].tripleId; });
            link.exit().remove(); 
            link = link.enter().append('path')
                .attr('class', 'link')
              .merge(link)
                .attr('stroke-width', function(d) { 
                    return sameWidth ? 2 : linkWidth(d[3].publicationCount); 
                })
                .attr('stroke', function(d, i) { 
                    return oneColor ? 'darkgrey' : d[3].color; 
                })
                .attr('marker-end', function(d) { 
                    var id = oneColor ? 'default' : d[3].id;
                    return 'url(#marker-' + id + ')'; 
                });
            
            // Nodes are the concepts
            node = g.select('g.nodes').selectAll('.node')
              .data(concepts.filter(function(d) { return d.id > 0; }),
                    function(d) { return d.id; });
            node.exit().remove();
            var nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .on('click', function(d, i) { console.log(d); })
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));
            
            // These will be removed and readded later on. First we need
            // to get the width when the text is added.
            nodeEnter.append('text')
                .text(function(d) { return d.name; })
                .attr('dy', '.35em');
                
            // The width takes the text length in account.
            nodeEnter.append('rect')
                .attr('width',  function(d) { 
                    var width = this.parentNode.getBBox().width + 5;
                    d.width = width;
                    return width; 
                })
                .attr('class', function(d) {
                    return d.type === 'gene' ? 'gene-node' : 'metabolite-node';
                })
                .attr('rx', function(d) { return d.type === 'gene' ? 0 : 3})
                .attr('height', nodeHeight);
                
            // Now that we know the width, the text will be readded.
            nodeEnter.selectAll('text').remove();
            nodeEnter.append('text')
                .text(function(d) { return d.name; })
                .attr('x', 3)
                .attr('y', nodeHeight / 2)
                .attr('dy', '.35em');
                
            node = nodeEnter.merge(node);
            
            // Add the nodes and links to the simulation
            simulation.nodes(concepts);
            simulation.force('link').links(predicates);
        });
    }
            
    function ticked() {
        if (link === undefined || node === undefined) return;
        
        link.attr('d', function(d) {
            var midX1 = d[0].width / 2,
                midX2 = d[2].width / 2,
                midY = nodeHeight / 2;
            
            var x1 = d[1].x,
                x2 = d[2].x + midX2,
                y1 = d[1].y,
                y2 = d[2].y + midY;
                
            var adjacent = x2 - x1, 
                opposite = y2 - y1,
                rad = Math.atan(opposite / adjacent),
                degree = rad * (180 / Math.PI),
                nodeRad = Math.atan((nodeHeight / 2) / (d[2].width / 2));
                nodeDegree = nodeRad * (180 / Math.PI);
            
            // Link ends at the upside or downside
            if (Math.abs(degree) > nodeDegree) {
                if (y2 < y1) { // Downside
                    var newY2 = d[2].y + nodeHeight;
                    var distanceFromCenter = (x2 - x1) / ((y1 - y2) / (nodeHeight / 2));
                    var newX2 = x2 - distanceFromCenter;
                } else { // Upside
                    var newY2 = d[2].y;
                    var distanceFromCenter = (x2 - x1) / ((y2 - y1) / (nodeHeight / 2));
                    var newX2 = x2 - distanceFromCenter;
                }
            } else { // Links ends at the sides
                if (x2 > x1) { // Left
                    var newX2 = d[2].x;
                    var distanceFromCenter = (y1 - y2) / ((x2 - x1) / (d[2].width / 2));
                    var newY2 = y2 + distanceFromCenter;
                } else { // Right
                    var newX2 = d[2].x + d[2].width;
                    var distanceFromCenter = (y1 - y2) / ((x1 - x2) / (d[2].width / 2));
                    var newY2 = y2 + distanceFromCenter;
                }
            }
            
            return 'M' + (d[0].x + midX1) + ',' + (d[0].y + midY)
                 + 'S' + d[1].x + ',' + d[1].y
                 + ' ' + newX2 + ',' + newY2;
        });
        node.attr('transform', function(d) {
            return 'translate(' + d.x + ',' + d.y + ')';
        });
    }
    
    function dragstarted(d) {
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        // Stop de simulation when the first node is dragged.
        simulation
            .force('charge', null)
            .force('center', null)
            .force('link', null);
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // Getters/setters with additional code:
    
    chart.concepts = function(value) {
        if (!arguments.length) return concepts;
        // concepts = $.extend(true, [], value); // deep-copy
        concepts = value.filter(function(c) { return c.show(); });
        conceptsById = d3.map(concepts, function(d) { return d.id; });
        
        // Actual width will be added later on, but the intermediate nodes do
        // not have a width, so initialise dummy values here.
        concepts.forEach(function(concept) { 
            if (!concept.width) concept.width = 1; 
        });
        return chart;
    };

    chart.predicates = function(value) {
        if (!arguments.length) return predicates;
        predicates = $.extend(true, [], value); // deep-copy
        predicates = predicates.filter(function(p) { 
            return allPredicatesById.get(p.id).show && 
                   p.publicationCount >= publicationCount &&
                   conceptsById.get(p.source) &&
                   conceptsById.get(p.target);
        });
        
        // Intermediate nodes will have a negative id to discriminate them from
        // actual nodes.
        bilinks = [];
        predicates.forEach(function(predicate, i) {
            var s = conceptsById.get(predicate.source),
                t = conceptsById.get(predicate.target),
                i = {id: -1 * (i + 1)}; // intermediate node
            concepts.push(i);
            predicates.push({source: predicate.source, target: i.id}, 
                            {source: i.id, target: predicate.target});
            bilinks.push([s, i, t, predicate]);
        });
        return chart;
    };
    
    chart.allPredicates = function(value) {
        if (!arguments.length) return allPredicates;
        allPredicates = value;
        allPredicatesById = d3.map(allPredicates, function(d) { return d.id; });
        return chart;
    };
    
    chart.lonelyConcepts = function(value) {
        if (!arguments.length) return lonelyConcepts;
        lonelyConcepts = value;
        // Filter concepts to only connected ones
        if (!lonelyConcepts) {
            var connectedConcepts = [];
            predicates.forEach(function(predicate) {
                connectedConcepts.push(predicate.source, predicate.target);
            });
            concepts = concepts.filter(function(c) { 
                return connectedConcepts.indexOf(c.id) > -1; 
            });
        }
        return chart;
    };
    
    // Simple getters/setters:
    
    chart.publicationCount = function(value) {
        if (!arguments.length) return publicationCount;
        publicationCount = value;
        return chart;
    };
    
    chart.publicationMax = function(value) {
        if (!arguments.length) return publicationMax;
        publicationMax = value;
        linkWidth.domain([1, publicationMax]);
        return chart;
    };
    
    chart.oneColor = function(value) {
        if (!arguments.length) return oneColor;
        oneColor = value;
        return chart;
    };
    
    chart.sameWidth = function(value) {
        if (!arguments.length) return sameWidth;
        sameWidth = value;
        return chart;
    };
    
    chart.width = function(value) {
        if (!arguments.length) return width;
        width = value;
        return chart;
    };

    chart.height = function(value) {
        if (!arguments.length) return height;
        height = value;
        return chart;
    };

    return chart;
}