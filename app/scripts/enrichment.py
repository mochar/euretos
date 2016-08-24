from collections import defaultdict
import numpy as np


class Enrichment:
    def __init__(self, euretos, metabolites, go='mf'):
        self.euretos = euretos
        self.metabolites = metabolites
        self.cutoff = 100
        self._find_go_concepts(go)
        self.matrix = self.calculate_matrix()
        self.sort()
        
    def _find_go_concepts(self, go):
        concepts = self.euretos.find_go_concepts(go)
        self._concepts = {c['id']: c['name'] for c in concepts}
        self.concepts = [c['id'] for c in concepts]
                
    def _iterate_connections(self, concepts):
        for connection in self.euretos.find_direct_connections(concepts):
            if connection['score'] < self.cutoff:
                break
            yield connection

    def _create_neighbour_dict(self, concepts):
        neighbours = defaultdict(list)
        for connection in self._iterate_connections(concepts):
            for source_node in connection['sourceNodes']:
                neighbour = connection['neighbour']
                neighbour['score'] = source_node['score']
                neighbours[source_node['id']].append(neighbour)
        return neighbours

    def calculate_matrix(self):
        matrix = np.zeros(shape=(len(self.concepts), len(self.metabolites)))
        concept_neighbours = self._create_neighbour_dict(self.concepts)
        metabolite_neigbours = self._create_neighbour_dict(self.metabolites)
        for i, concept in enumerate(concept_neighbours.items()):
            concept, c_neighbours = concept
            c_neighbours_by_id = {n['id']: n for n in c_neighbours}
            c_neighbour_ids = [n['id'] for n in c_neighbours]
            for j, metabolite in enumerate(metabolite_neigbours.items()):
                metabolite, m_neighbours = metabolite
                m_neighbours_by_id = {n['id']: n for n in m_neighbours}
                all_ids = set([n['id'] for n in m_neighbours] + c_neighbour_ids)
                a, b = zip(*[(c_neighbours_by_id.get(id_, {'score':0})['score'], 
                              m_neighbours_by_id.get(id_, {'score':0})['score']) 
                              for id_ in all_ids])
                matrix[i][j] = np.inner(np.array(a), np.array(b))
        return matrix

    def sort(self):
        scores = self.matrix.sum(axis=1)
        indices = scores.argsort()[::-1]
        self.sorted_concepts = [{'name': self._concepts[self.concepts[i]], 'score': scores[i]} for i in indices]
