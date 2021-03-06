function graphChart(selector, selectedConcept) {
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
        
    var link, 
        node,
        selectedConcept = selectedConcept || ko.observable();
        
    // data variables
    var concepts = [],
        conceptsById = d3.map(),
        predicates = [],
        allPredicates = [],
        allPredicatesById = d3.map(),
        bilinks = [];
        
    // d3-force objects
    var linkForce = d3.forceLink().distance(100),
        chargeForce = d3.forceManyBody().strength(-80),
        centerForce = d3.forceCenter(),
        simulation = d3.forceSimulation().on('tick', ticked);
        
    // Chart initialisation
    var svg = d3.select(selector).append('svg'),
        g = svg.append('g'),
        defs = svg.append('defs');
    g.append('g').attr('class', 'links');
    g.append('g').attr('class', 'nodes');

    var zoom = d3.zoom()
        .scaleExtent([0.4, 8])
        .on('zoom', function() { g.attr('transform', d3.event.transform); });
    svg.call(zoom);
    
    function chart() {
        // Update the SVG dimensions.
        svg.attr('width', width).attr('height', height);
        
        // Update simulation
        simulation
            .nodes(concepts)
            .force('link', linkForce.links(predicates))
            .force('charge', chargeForce)
            .force('center', centerForce.x(width / 2).y(height / 2))
        
        // Create arrow-head markers per predicate-type
        var marker = defs.selectAll('marker')
            .data(allPredicates.concat(['marker-default']), function(d) { 
                return d.id ? d.id : d; 
            });
        marker.exit().remove();
        var markerEnter = marker.enter().append('marker')
            .attr('id', function(d) { return d.id ? 'marker-' + d.id : d; })
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 6)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto');
        markerEnter.append('path')
            .attr('d', 'M0,-5L10,0L0,5');
        markerEnter.merge(marker)
            .attr('fill', function(d) { return d.id ? d.color : 'darkgrey'; })
            .attr('color', function(d) { return d.id ? d.color : 'darkgrey'; });
        
        // Links are the predicates that connect the concepts (nodes)
        link = g.select('g.links')
            .selectAll('.link')
            .data(bilinks, function(d) { return d[3].tripleId; });
        link.exit().remove(); 
        var linkEnter = link.enter().append('path')
            .attr('class', 'link');
        linkEnter
            .on('mouseover', function(d) {
                d3.select(this).attr('stroke-dasharray', '2,2');
            })
            .on('mouseout', function(d) {
                d3.select(this).attr('stroke-dasharray', '0');
            })
          .append('title')
            .text(function(d) { return d[3].name; });
        link = linkEnter.merge(link)
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
            .on('click', function(d, i) { 
                if (selectedConcept() && selectedConcept().id == d.id) {
                    selectedConcept(null);
                    fade(1)(d, i);
                } else {
                    fade(.1)(d, i);
                }
            })
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
    
    function fade(opacity) {
        return function(c, i) {
            var predicates_ = predicates.filter(function(p) {
                    return p.tripleId && p.source.id == c.id;
                }),
                triples = predicates_.map(function(p) { return p.tripleId; }),
                connectedConcepts = predicates_.map(function(p) {
                    return p.target.id;
                });
                
            selectedConcept({id: c.id, connected: connectedConcepts});
            
            svg.selectAll('g.nodes rect, g.nodes text')
              .transition()
                .style('opacity', function(d) {
                    return d.id == c.id || connectedConcepts.indexOf(d.id) > -1 ? 1 : opacity; 
                });
            
            svg.selectAll('g.links path')
              .transition()
                .style('opacity', function(d) {
                    return triples.indexOf(d[3].tripleId) > -1 ? 1 : opacity;
                });
        };
    }
    
    chart.zoom = function(concept) {
        concepts.forEach(function(c) {
            if (c.id === concept.id) {
                var x0 = c.x,
                    x1 = c.x + c.width,
                    y0 = c.y,
                    y1 = c.y + nodeHeight,
                    k = 0.2 / Math.max((x1 - x0) / width, (y1 - y0) / height),
                    tx = (width - k * (x0 + x1)) / 2,
                    ty = (height - k * (y0 + y1)) / 2;
                svg.transition()
                    .duration(1500)
                    .call(zoom.transform, d3.zoomIdentity
                        .translate(tx, ty)
                        .scale(k));
                return;
            }
        })
    }

    chart.concepts = function(value) {
        if (!arguments.length) return concepts;
        
        var newConcepts = [];
        value = $.extend(true, [], value); // deep-copy
        value.forEach(function(concept) {
            if (concept.show()) {
                concept.width = 1;
                var c = conceptsById.get(concept.id);
                c ? newConcepts.push(c) : newConcepts.push(concept);
            }
        });
        conceptsById = d3.map(newConcepts, function(d) { return d.id; });
        concepts.forEach(function(concept) {
            if (concept.id < 0 && 
                conceptsById.get(concept.source) && 
                conceptsById.get(concept.target)) newConcepts.push(concept);
        })
        concepts = newConcepts;
        return chart;
    };
    
    chart.allPredicates = function(value) {
        if (!arguments.length) return allPredicates;
        allPredicates = value;
        allPredicatesById = d3.map(allPredicates, function(d) { return d.id; });
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
        
        predicates.forEach(function(predicate) {
            predicate.source = conceptsById.get(predicate.source);
            predicate.target = conceptsById.get(predicate.target);
        });
        
        // Intermediate nodes will have a negative id to distinguish them from
        // actual nodes.
        bilinks = [];
        predicates.forEach(function(predicate, i) {
            var s = predicate.source,
                t = predicate.target,
                i = {id: -1 * (i + 1), 
                    source: predicate.source.id, 
                    target: predicate.target.id};
            concepts.push(i);
            predicates.push({source: s, target: i}, 
                            {source: i, target: t});
            bilinks.push([s, i, t, predicate]);
        });
        simulation.alpha(.5).restart();
        return chart;
    };
    
    chart.lonelyConcepts = function(value) {
        if (!arguments.length) return lonelyConcepts;
        lonelyConcepts = value;
        // Filter concepts to only connected ones
        if (!lonelyConcepts) {
            var connectedConcepts = [];
            predicates.forEach(function(predicate) {
                connectedConcepts.push(predicate.source.id, predicate.target.id);
            });
            concepts = concepts.filter(function(c) { 
                return connectedConcepts.indexOf(c.id) > -1; 
            });
        }
        return chart;
    };
    
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
    
    chart.distance = function(value) {
        if (!arguments.length) return linkForce.distance();
        linkForce.distance(value);
        return chart;
    }
    
    chart.strength = function(value) {
        if (!arguments.length) return chargeForce.strength();
        chargeForce.strength(value);
        return chart;
    }
    
    return chart;
}