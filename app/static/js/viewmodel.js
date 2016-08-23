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
        return data.filter(function(d) {
            return d.name.lastIndexOf(searchWord, 0) === 0;
        });
    }).extend({ throttle: 500 });
    
    self.pagination = new Pagination(self.filteredData);
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
    self.graphDirty = ko.observable(false); // Set to true to update graph
    
    // Whether to show the genes table (true) or metabolites table (false)
    // Boolean for ease of use
    self.showGeneTable = ko.observable(true);
    
    self.reset = function() {
        self.concepts([]);
        self.predicates([]);
        self.allPredicates([]);
    }
    
    self.updateGraph = function() {
        self.graphDirty(true);
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
        self.loading(true);
        $.ajax({
            url: '/concepts',
            type: 'POST',
            data: formData,
            async: true,
            success: function(data, textStatus, jqXHR) {
                if (formData.get('genes') === '') self.showGeneTable(false);
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
                self.graphDirty(true);
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
