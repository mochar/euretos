function Pagination(data) {
    var self = this;
    self.data = data;
    self.items = 12;
    self.page = ko.observable(1);
    self.pages = ko.computed(function() {
        return Math.ceil(self.data().length / self.items);
    });
    self.offset = ko.computed(function() {
        return (self.page() - 1) * self.items;
    });
    self.dataToShow = ko.computed(function() {
        var offset = self.offset();
        return self.data().slice(offset, offset + self.items + 1);
    });
    self.prev = function() { if (self.canPrev()) self.page(self.page() - 1); };
    self.next = function() { if (self.canNext()) self.page(self.page() + 1); };
    self.canPrev = ko.computed(function() { return self.page() > 1; });
    self.canNext = ko.computed(function() { return self.page() < self.pages(); });
}

function ViewModel() {
    var self = this;
    self.concepts = ko.observableArray([]);
    self.predicates = ko.observableArray([]);
    self.allPredicates = ko.observableArray([]);
    
    self.metabolites = ko.computed(function() {
        return self.concepts().filter(function(c) { return c.type === 'metabolite'});
    });
    self.metabolitesPagination = new Pagination(self.metabolites);
    
    self.genes = ko.computed(function() {
        return self.concepts().filter(function(c) { return c.type === 'gene'});
    });
    self.genesPagination = new Pagination(self.genes);
    
    self.publicationCount = ko.observable(1);
    self.publicationMax = ko.observable(100);
    self.oneColor = ko.observable(false);
    self.sameWidth = ko.observable(false);
    self.lonelyConcepts = ko.observable(false);
    
    self.dirty = ko.observable(false); // Automatically set to true when a parameter changes
    self.graph = graphChart();
    
    self.chebiUrl = 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:';
    self.entrezUrl = 'http://www.ncbi.nlm.nih.gov/gene/?term=';
    
    self.reset = function() {
        self.concepts([]);
        self.predicates([]);
        self.allPredicates([]);
    }
    
    self.updateChart = function() {
        var graphElement = d3.select('#graph');
        self.graph
            .concepts(self.concepts())
            .allPredicates(self.allPredicates())
            .predicates(self.predicates())
            .publicationCount(self.publicationCount())
            .publicationMax(self.publicationMax())
            .oneColor(self.oneColor())
            .sameWidth(self.sameWidth())
            .lonelyConcepts(self.lonelyConcepts())
            .width(graphElement.style('width').replace(/px/g, ''))
            .height(graphElement.style('height').replace(/px/g, ''));
        graphElement.datum([]).call(self.graph);
        self.dirty(false);
    }
    
    // This computed is here to detect changes to observables
    // that need to update the graph.
    ko.computed(function() {
        self.publicationCount();
        self.dirty(true);
    });
    
    self.getConcepts = function(formElement) {
        var formData = new FormData(formElement);
        $.ajax({
            url: '/concepts',
            type: 'POST',
            data: formData,
            async: true,
            success: function(data, textStatus, jqXHR) {
                console.log(data);
                self.concepts(data.concepts.map(function(concept) {
                    concept.show = ko.observable(true);
                    return concept;
                }));
                self.getPredicates();
            },
            cache: false,
            contentType: false,
            processData: false
        });
    };
    
    self.getPredicates = function() {
        var data = {concepts: self.concepts().map(function(c) { return c.id })};
        $.ajax({
            url: '/predicates',
            type: 'POST',
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            success: function (data) {
                console.log(data);
                console.log('----------------------\n');
                self.publicationMax(d3.max(data.predicates, function(p) { return p.publicationCount; }))
                self.dirty(false);
                self.predicates(data.predicates);
                self.allPredicates(data.all.map(function(predicate) {
                    predicate.show = true;
                    return predicate;
                }));
                $('#predicates-filter').multipleSelect('refresh');
                self.updateChart();
            },
            data: JSON.stringify(data)
        });
    };
    
    $('#predicates-filter').multipleSelect({
        filter: true,
        placeholder: 'Predicates',
        styler: function(value) {
            var predicates = self.allPredicates();
            for(var i=0; i<predicates.length; i++) {
                if (predicates[i].id == value)
                    return 'border-left: 5px solid ' + predicates[i].color + ';';
            }
        },
        onClick: function(view) {
            var selected = $('#predicates-filter').multipleSelect('getSelects');
            if (selected.length === 0) {
                self.allPredicates().forEach(function(p) { p.show = true; });
            } else {
                self.allPredicates().forEach(function(predicate) {
                    predicate.show = selected.indexOf(predicate.id) > -1;
                });
            }
            self.dirty(true);
        },
        onCheckAll: function() {
            self.allPredicates().forEach(function(p) { p.show = true; });
            self.dirty(true);
        },
        onUncheckAll: function() {
            self.allPredicates().forEach(function(p) { p.show = true; });
            self.dirty(true);
        }
    });
    
    $('#options').multipleSelect({
        placeholder: 'Options',
        selectAll: false,
        onClick: function(view) {
            switch(view.value) {
                case 'oneColor':
                    self.oneColor(view.checked);
                    break;
                case 'sameWidth':
                    self.sameWidth(view.checked);
                    break;
                case 'lonelyConcepts':
                    self.lonelyConcepts(view.checked);
            }
            self.dirty(true);
        }
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
