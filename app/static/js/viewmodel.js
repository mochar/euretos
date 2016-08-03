
function ViewModel() {
    var self = this;
    self.concepts = ko.observableArray([]);
    self.predicates = ko.observableArray([]);
    self.selectedConcepts = ko.observableArray([]);
    
    self.chebi_url = 'https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:';
    
    self.publicationCount = ko.observable(1);
    
    self.reset = function() {
        self.concepts([]);
        self.predicates([]);
        self.selectedConcepts([]);
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
                self.predicates(data.predicates);
            },
            data: JSON.stringify(data)
        });
    };
}

$(function() {
    ko.applyBindings(new ViewModel());
});
