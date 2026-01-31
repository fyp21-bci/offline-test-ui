from typing import Dict, Type, List, Any
from app.core.interfaces import Processor, DataLoader

class Registry:
    _processors: Dict[str, Type[Processor]] = {}
    _dataloaders: Dict[str, Type[DataLoader]] = {}

    @classmethod
    def register_processor(cls, processor_cls: Type[Processor]):
        cls._processors[processor_cls.name] = processor_cls

    @classmethod
    def register_dataloader(cls, loader_cls: Type[DataLoader]):
        cls._dataloaders[loader_cls.name] = loader_cls

    @classmethod
    def get_processor(cls, name: str) -> Type[Processor]:
        return cls._processors.get(name)

    @classmethod
    def get_dataloader(cls, name: str) -> Type[DataLoader]:
        return cls._dataloaders.get(name)
    
    @classmethod
    def list_processors(cls) -> List[Dict[str, str]]:
        return [
            {
                "name": p.name, 
                "description": p.description, 
                "result_type": p.result_type.value
            } 
            for p in cls._processors.values()
        ]

    @classmethod
    def list_dataloaders(cls) -> List[Dict[str, Any]]:
        return [
            {"name": l.name, "extensions": l.extensions}
            for l in cls._dataloaders.values()
        ]

    @classmethod
    def get_dataloader_for_file(cls, filepath: str) -> Type[DataLoader]:
        """
        Find a compatible dataloader for the given file.
        Simple extension matching for now, could be improved.
        """
        for loader in cls._dataloaders.values():
            for ext in loader.extensions:
                if filepath.endswith(ext):
                    return loader
        return None
