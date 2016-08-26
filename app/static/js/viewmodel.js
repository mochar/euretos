function Pagination(data) {
    var self = this;
    self.data = data;
    self.items = 20;
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

function Table(data, columns, url) {
    var self = this;
    self.data = data;
    self.columns = columns;
    self.url = url;
    self.searchWord = ko.observable('');

    self.filteredData = ko.computed(function() {
        var searchWord = self.searchWord(),
            data = self.data();
        if (self.pagination) self.pagination.page(1);
        return data.filter(function(d) {
            return d.name.lastIndexOf(searchWord, 0) === 0;
        });
    }).extend({ throttle: 500 });
    
    self.pagination = new Pagination(self.filteredData);
}

function EnrichmentViewModel(concepts) {
    var self = this;
    self.enriching = ko.observable(false);
    self.gos = ko.observableArray([]);
    self.concepts = concepts;

    self.enrich = function(formElement) {
        self.enriching(true);
        var formData = new FormData(formElement),
            concepts = self.concepts().map(function(c) { return c.id; }),
            data = {go: formData.get('go'), concepts: concepts};
        $.ajax({
            type: 'POST',
            url: '/enrichment',
            data: data,
            success: function(data){
                self.gos(data.gos);
                self.enriching(false);
            },
            dataType: 'json'
        });
    };
}

function ViewModel() {
    var self = this;
    
    // Graph data
    self.concepts = ko.observableArray([]);
    self.predicates = ko.observableArray([]);
    self.allPredicates = ko.observableArray([]);
    
    // Metabolite concepts
    self.metabolites = ko.computed(function() {
        return self.concepts().filter(function(c) { return c.type === 'metabolite'});
    });
    self.metaboliteTable = new Table(self.metabolites, ['Metabolite', 'Euretos', 'CHEBI'], 
        'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:');
    
    // Gene concepts
    self.genes = ko.computed(function() {
        return self.concepts().filter(function(c) { return c.type === 'gene'});
    });
    self.geneTable = new Table(self.genes, ['Gene', 'Euretos', 'Entrez'], 
        'http://www.ncbi.nlm.nih.gov/gene/?term=');
    
    // Graph parameters
    self.publicationCount = ko.observable(1);
    self.publicationMax = ko.observable(100);
    self.oneColor = ko.observable(false);
    self.sameWidth = ko.observable(false);
    self.lonelyConcepts = ko.observable(false);
    
    // True when waiting response from server
    self.loading = ko.observable(false);
    
    // Graph updating
    self.dirty = ko.observable(false); // Automatically set to true when a parameter changes
    self.graph = graphChart('#graph');
    
    // Whether to show the genes table (true) or metabolites table (false)
    // Boolean for ease of use
    self.tab = ko.observable('graph');
    self.enrichmentVM = new EnrichmentViewModel(self.concepts);
    
    self.reset = function() {
        self.predicates([]);
        self.allPredicates([]);
        self.enrichmentVM.gos([]);
        self.concepts([]);
    }
    
    self.updateChart = function() {
        var graphElement = d3.select('#graph');
        self.graph
            .concepts(self.concepts())
            .allPredicates(self.allPredicates())
            .predicates(self.predicates())
            .width(graphElement.style('width').replace(/px/g, ''))
            .height(graphElement.style('height').replace(/px/g, ''));
        self.graph();
        self.dirty(false);
    }
    
    // This computed is here to detect changes to observables
    // that need to update the graph.
    ko.computed(function() {
        self.publicationCount();
        self.oneColor();
        self.sameWidth();
        self.lonelyConcepts();
        self.dirty(true);
    });
    
    self.getConcepts = function(formElement) {
        var formData = new FormData(formElement);
        self.loading(true);
        $.ajax({
            url: '/concepts',
            type: 'POST',
            data: formData,
            async: true,
            success: function(data, textStatus, jqXHR) {
                self.concepts(data.concepts.map(function(concept) {
                    concept.show = ko.observable(true);
                    return concept;
                }));
                self.publicationMax(d3.max(data.predicates, function(p) { return p.publicationCount; }))
                self.dirty(false);
                self.predicates(data.predicates);
                self.allPredicates(data.all.map(function(predicate) {
                    predicate.show = true;
                    return predicate;
                }));
                $('#predicates-filter').multipleSelect('refresh');
                self.updateChart();
                self.loading(false);
            },
            cache: false,
            contentType: false,
            processData: false
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
}

$(function() {
    ko.applyBindings(new ViewModel());
});
