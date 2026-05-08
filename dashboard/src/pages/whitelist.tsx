import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getWhitelist, addToWhitelist, toggleWhitelist, removeFromWhitelist, updateWhitelist } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Users, Phone, User } from "lucide-react";
import type { WhitelistItem } from "@/lib/api";

export function WhitelistPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<WhitelistItem | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");

  const { data: whitelist, isLoading } = useQuery({
    queryKey: ["whitelist"],
    queryFn: getWhitelist,
  });

  const addMutation = useMutation({
    mutationFn: ({ phone, name }: { phone: string; name: string }) =>
      addToWhitelist(phone, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelist"] });
      setIsAddOpen(false);
      setNewPhone("");
      setNewName("");
      toast({
        title: "Usuario adicionado",
        description: "O usuario foi adicionado a whitelist com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao adicionar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => toggleWhitelist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelist"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WhitelistItem> }) =>
      updateWhitelist(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelist"] });
      setEditItem(null);
      toast({
        title: "Usuario atualizado",
        description: "As informacoes foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => removeFromWhitelist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whitelist"] });
      toast({
        title: "Usuario removido",
        description: "O usuario foi removido da whitelist.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    if (!newPhone.trim() || !newName.trim()) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha o telefone/ID e o nome.",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate({ phone: newPhone.trim(), name: newName.trim() });
  };

  const handleUpdate = () => {
    if (!editItem) return;
    updateMutation.mutate({
      id: editItem.id,
      data: { phone: editItem.phone, name: editItem.name },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Whitelist</h1>
          <p className="text-muted-foreground">
            Gerencie os usuarios autorizados a usar o bot
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Usuario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Usuario</DialogTitle>
              <DialogDescription>
                Adicione um novo usuario a whitelist do bot
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telegram ID / Telefone</Label>
                <Input
                  id="phone"
                  placeholder="Ex: 123456789"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  O usuario pode obter seu ID enviando /id para o bot
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Ex: Joao Silva"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={addMutation.isPending}>
                {addMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Usuarios Autorizados
          </CardTitle>
          <CardDescription>
            {whitelist?.length ?? 0} usuarios cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : whitelist?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuario cadastrado</p>
              <p className="text-sm">Adicione usuarios para autorizar o uso do bot</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID/Telefone</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whitelist?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        {item.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {item.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.active}
                          onCheckedChange={() => toggleMutation.mutate(item.id)}
                          disabled={toggleMutation.isPending}
                        />
                        <Badge variant={item.active ? "default" : "secondary"}>
                          {item.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog
                          open={editItem?.id === item.id}
                          onOpenChange={(open) => !open && setEditItem(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditItem(item)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Usuario</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Telegram ID / Telefone</Label>
                                <Input
                                  value={editItem?.phone ?? ""}
                                  onChange={(e) =>
                                    setEditItem((prev) =>
                                      prev ? { ...prev, phone: e.target.value } : null
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input
                                  value={editItem?.name ?? ""}
                                  onChange={(e) =>
                                    setEditItem((prev) =>
                                      prev ? { ...prev, name: e.target.value } : null
                                    )
                                  }
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditItem(null)}>
                                Cancelar
                              </Button>
                              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? "Salvando..." : "Salvar"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover usuario?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover {item.name} da whitelist?
                                Esta acao nao pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeMutation.mutate(item.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
