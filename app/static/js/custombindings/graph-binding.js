ko.bindingHandlers.graph = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var width = $(element).width();
            height = d3.max([600, $(element).height()]),
            svg = d3.select(element).append('svg')
                .attr('width', width)
                .attr('height', height),
            g = svg.append('g');
        
        // Markers (arrow-head) per predicate-type
        svg.append('defs').selectAll('marker')
            .data(['default'])
          .enter().append('marker')
            .attr('id', function(d) { return d; })
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 6)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
          .append('path')
            .attr('d', 'M0,-5L10,0L0,5');
            
        g.append('g').attr('class', 'links');
        g.append('g').attr('class', 'nodes');
            
        svg.call(d3.zoom()
            .scaleExtent([1 / 2, 8])
            .translateExtent([[0-width, 0-height], [width+width, height+height]])
            .on('zoom', function() {
                g.attr('transform', d3.event.transform);
            }));
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var dirty = valueAccessor();
        if (!dirty()) return;
        dirty(false);
        console.log('update');
            
        var publicationCount = bindingContext.$root.publicationCount(),
            publicationMax = bindingContext.$root.publicationMax(),
            oneColor = bindingContext.$root.oneColor(),
            sameWidth = bindingContext.$root.sameWidth(),
            lonelyConcepts = bindingContext.$root.lonelyConcepts();
        
        var concepts = bindingContext.$root.concepts.peek(),
            concepts = $.extend(true, [], concepts), // deep-copy 
            concepts = concepts.filter(function(c) { return c.show(); });
            conceptsById = d3.map(concepts, function(d) { return d.id; });
            
        var allPredicates = bindingContext.$root.allPredicates.peek(),
            allPredicatesById = d3.map(allPredicates, function(d) { return d.id; }),
            predicates = bindingContext.$root.predicates.peek(),
            predicates = $.extend(true, [], predicates), // deep-copy
            predicates = predicates.filter(function(p) { 
                return allPredicatesById.get(p.id).show && 
                       p.publicationCount >= publicationCount &&
                       conceptsById.get(p.source) &&
                       conceptsById.get(p.target);
            })
            bilinks = []; //https://bl.ocks.org/mbostock/4600693
        
        // Filter concepts to only connected ones
        var connectedConcepts = [];
        predicates.forEach(function(predicate) {
            connectedConcepts.push(predicate.source, predicate.target);
        });
        if (!lonelyConcepts) {
            concepts = concepts.filter(function(c) { return connectedConcepts.indexOf(c.id) > -1; });
        }
        
        // Intermediate nodes will have a negative id to discriminate them from
        // actual nodes.
        predicates.forEach(function(predicate, i) {
            var s = conceptsById.get(predicate.source),
                t = conceptsById.get(predicate.target),
                i = {id: -1 * (i + 1)}; // intermediate node
            concepts.push(i);
            predicates.push({source: predicate.source, target: i.id}, 
                            {source: i.id, target: predicate.target});
            bilinks.push([s, i, t, predicate]);
        });
        
        // Actual width will be added later on, but the intermediate nodes do
        // not have a width, so initialise dummy values here.
        concepts.forEach(function(concept) {
            concept.width = 1;
        });

        var width = $(element).width(),
            height = d3.max([600, $(element).height()]),
            svg = d3.select(element).select('svg'),
            defs = svg.select('defs'),
            g = svg.select('g'),
            nodeHeight = 20,
            linkWidth = d3.scaleLog()
                .domain([1, publicationMax])
                .range([2, 6]);
        
        // Empty previous elements to start fresh.
        g.selectAll('g').selectAll('*').remove();
            
        // Link nodes are identified by d.id, so we don't have to add the nodes manually
        // to the link objects.
        var simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(function(d) { return d.id; }).distance(100))
            .force('charge', d3.forceManyBody().strength(-40))
            .force('center', d3.forceCenter(width / 2, height / 2));

        var link = g.select('g.links').selectAll('.link').data(bilinks);
        link.exit().remove();
        link = link.enter().append('path')
            .attr('class', 'link')
            .attr('stroke-width', function(d) { 
                return sameWidth ? 2 : linkWidth(d[3].publicationCount); 
            })
            .attr('stroke', function(d, i) { 
                return oneColor ? 'darkgrey' : d[3].color; 
            })
            .attr('marker-end', function(d) { return 'url(#default)'; });
            
        var node = g.select('g.nodes').selectAll('.node')
          .data(concepts.filter(function(d) { return d.id > 0; }));
        node.exit().remove();
        node = node.enter().append('g')
            .attr('class', 'node')
            .on('click', function(d, i) {
                console.log(d);
            })
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // These will be removed and readded later on. First we need
        // to get the width when the text is added.
        node.append('text')
            .text(function(d) { return d.name; })
            .attr('dy', '.35em');
          
        // The width takes the text length in account.
        node.append('rect')
            .attr('width',  function(d) { 
                var width = this.parentNode.getBBox().width + 5;
                d.width = width;
                return width; 
            })
            .attr('height', nodeHeight);

        // Now that we know the width, the text will be readded.
        node.selectAll('text').remove()
        node.append('text')
            .text(function(d) { return d.name; })
            .attr('x', 3)
            .attr('y', nodeHeight / 2)
            .attr('dy', '.35em');
                
        simulation.nodes(concepts).on('tick', ticked);
        simulation.force('link').links(predicates);
        
        function ticked() {
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
    }
};