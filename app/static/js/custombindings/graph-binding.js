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
            .data(['suit', 'licensing', 'resolved'])
          .enter().append('marker')
            .attr('id', function(d) { return d; })
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 15)
            .attr('refY', -1.5)
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
        
        var concepts = bindingContext.$root.concepts.peek(),
            concepts = $.extend(true, [], concepts), // deep-copy 
            conceptsById = d3.map(concepts, function(d) { return d.id; }),
            predicates = bindingContext.$root.predicates.peek(),
            predicates = $.extend(true, [], predicates), // deep-copy
            allPredicates = bindingContext.$root.allPredicates.peek(),
            allPredicatesById = d3.map(allPredicates, function(d) { return d.id; }),
            predicates = predicates.filter(function(p) { return allPredicatesById.get(p.id).show(); })
            bilinks = []; //https://bl.ocks.org/mbostock/4600693
        
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
            nodeHeight = 20;
        
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
            .attr('stroke', function(d, i) { return d[3].color; });
            // .attr('marker-end', function(d) { return 'url(#licensing)'; });
            
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
                var midX = d[0].width / 2,
                    midY = nodeHeight / 2;
                return 'M' + (d[0].x + midX) + ',' + (d[0].y + midY)
                     + 'S' + d[1].x + ',' + d[1].y
                     + ' ' + (d[2].x + midX) + ',' + (d[2].y + midY);
                // var sourceX = d[0].x + (d[0].width / 2),
                //     sourceY = d[0].y + (nodeHeight / 2),
                //     targetX = d[2].x + (d[2].width / 2),
                //     targetY = d[2].y + (nodeHeight / 2);
                // var deltaX = targetX - sourceX,
                //     deltaY = targetY - sourceY,
                //     dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                //     normX = deltaX / dist,
                //     normY = deltaY / dist,
                //     sourcePadding = d.left ? 17 : 12,
                //     targetPadding = d.right ? 17 : 12,
                //     sourceX = sourceX + (sourcePadding * normX),
                //     sourceY = sourceY + (sourcePadding * normY),
                //     targetX = targetX - (targetPadding * normX),
                //     targetY = targetY - (targetPadding * normY);
                // return 'M' + sourceX + ',' + sourceY
                //      + 'S' + d[1].x + ',' + d[1].y
                //      + ' ' + targetX + ',' + targetY;
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