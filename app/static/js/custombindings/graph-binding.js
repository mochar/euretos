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
            .on('zoom', zoomed));
        
        function zoomed() {
            g.attr('transform', d3.event.transform);
        }
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        console.log('update');
        var concepts = bindingContext.$root.concepts.peek(),
            conceptsById = d3.map(concepts, function(d) { return d.id; }),
            predicates = bindingContext.$root.predicates(),
            bilinks = []; //https://bl.ocks.org/mbostock/4600693
            
        predicates.forEach(function(predicate) {
            var s = predicate.source = conceptsById.get(predicate.source),
                t = predicate.target = conceptsById.get(predicate.target),
                i = {}; // intermediate node
            concepts.push(i);
            predicates.push({source: s, target: i}, {source: i, target: t});
            bilinks.push([s, i, t]);
        });

        var width = $(element).width(),
            height = d3.max([600, $(element).height()]),
            svg = d3.select(element).select('svg'),
            defs = svg.select('defs'),
            g = svg.select('g'),
            nodeHeight = 20;
            
        var simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(function(d) { return d.id; }).distance(100))
            .force('charge', d3.forceManyBody().strength(-40))
            .force('center', d3.forceCenter(width / 2, height / 2));
        
        var link = g.select('g.links').selectAll('.link')
          .data(bilinks);
        link.exit().remove();
        link = link.enter().append('path')
            .attr('class', 'link')
            .attr('stroke', function(d, i) { return predicates[i].color; });
            // .attr('marker-end', function(d) { return 'url(#licensing)'; });
        
        var node = g.select('g.nodes').selectAll('.node')
          .data(concepts.filter(function(d) { return d.id; }));
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
            
        node.append('text')
            .text(function(d) { return d.name; })
            .attr('dy', '.35em');
          
        node.append('rect')
            .attr('width',  function(d) { 
                var width = this.parentNode.getBBox().width + 5;
                d.width = width;
                return width; 
            })
            .attr('height', nodeHeight);
            
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
                // var midX = d[0].width / 2,
                //     midY = nodeHeight / 2;
                // return 'M' + (d[0].x + midX) + ',' + (d[0].y + midY)
                //      + 'S' + d[1].x + ',' + d[1].y
                //      + ' ' + (d[2].x + midX) + ',' + (d[2].y + midY);
                var sourceX = d[0].x + (d[0].width / 2),
                    sourceY = d[0].y + (nodeHeight / 2),
                    targetX = d[2].x + (d[2].width / 2),
                    targetY = d[2].y + (nodeHeight / 2);
                var deltaX = targetX - sourceX,
                    deltaY = targetY - sourceY,
                    dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                    normX = deltaX / dist,
                    normY = deltaY / dist,
                    sourcePadding = d.left ? 17 : 12,
                    targetPadding = d.right ? 17 : 12,
                    sourceX = sourceX + (sourcePadding * normX),
                    sourceY = sourceY + (sourcePadding * normY),
                    targetX = targetX - (targetPadding * normX),
                    targetY = targetY - (targetPadding * normY);
                return 'M' + sourceX + ',' + sourceY
                     + 'S' + d[1].x + ',' + d[1].y
                     + ' ' + targetX + ',' + targetY;
            });
            node.attr('transform', function(d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            })
        }

        function dragstarted(d) {
            if (!d3.event.active) simulation.alphaTarget(0.3).restart();
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