from collections import defaultdict
import numpy as np


class Enrichment:
    def __init__(self, euretos, metabolites, concepts):
        self.euretos = euretos
        self.cutoff = 1000
        self.calculate_matrix(metabolites, concepts)
                
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

    def calculate_matrix(self, metabolites, concepts):
        matrix = np.zeros(shape=(len(concepts), len(metabolites)))
        concept_neighbours = self._create_neighbour_dict(concepts)
        metabolite_neigbours = self._create_neighbour_dict(metabolites)
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