
function ViewModel() {
    var self = this;
    self.concepts = ko.observableArray([]);
    self.selectedConcepts = ko.observableArray([]);
    self.predicates = ko.observableArray([]);
    self.allPredicates = ko.observableArray([]);
    
    self.chebi_url = 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:';
    
    self.publicationCount = ko.observable(1);
    self.graphDirty = ko.observable(false);
    
    self.reset = function() {
        self.concepts([]);
        self.selectedConcepts([]);
        self.predicates([]);
        self.allPredicates([]);
    }
    
    self.selectConcept = function() {
        console.log(this);
        console.log(arguments);
    }
    
    self.getConcepts = function(formElement) {
        var formData = new FormData(formElement);
        $.ajax({
            url: '/concepts',
            type: 'POST',
            data: formData,
            async: true,
            success: function(data, textStatus, jqXHR) {
                console.log(data);
                self.concepts(data.concepts);
                formElement.reset();
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
                self.predicates(data.predicates);
                self.allPredicates(data.all.map(function(predicate) {
                    predicate.show = true;
                    return predicate;
                }));
                $('#predicates-filter').multipleSelect('refresh');
                self.graphDirty(true);
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
            self.allPredicates().forEach(function(predicate) {
                if (predicate.id == view.value) predicate.show = false;
            });
            self.graphDirty(true);
        },
        onCheckAll: function() {
            self.allPredicates().forEach(function(p) { p.show = true; });
            self.graphDirty(true);
        },
        onUncheckAll: function() {
            self.allPredicates().forEach(function(p) { p.show = true; });
            self.graphDirty(true);
        }
    });
}

$(function() {
    ko.applyBindings(new ViewModel());
});
